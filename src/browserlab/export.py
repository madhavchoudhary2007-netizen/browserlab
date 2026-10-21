"""Single-experiment exports. Every file carries provenance; protocols are never pooled."""
from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import json
import os
import time
from pathlib import Path
from typing import Any, Iterable

APP_VERSION = "0.1.0"
FORMATS = {"csv_trials": ".csv", "csv_conditions": ".csv", "xlsx": ".xlsx", "json": ".json", "pdf": ".pdf", "png": ".png"}
MAX_IMAGE_BYTES = 4_000_000
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"

LIMITATIONS = (
    "Trial-level observations are the unit of analysis; 1-second samples within a trial are not independent replications.",
    "Memory is process-tree physical footprint where available (macOS); it is not RSS or system memory.",
    "A non-significant p-value does not show equivalence or absence of an effect.",
    "Experiments with fewer than five repetitions per condition are exploratory and have low statistical power.",
    "This report covers a single experiment/protocol; it must not be pooled with others of a different protocol.",
)


class ExportError(ValueError):
    pass


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def provenance(info: dict[str, Any], source: Path, analysis: dict[str, Any]) -> dict[str, Any]:
    keys = ("id", "suite", "status", "protocol_key", "scheduled_trials", "completed_trials", "browsers", "workloads",
            "tab_levels", "repetitions", "warmup_seconds", "measure_seconds", "sample_interval_seconds", "system", "warnings")
    return {
        "app": f"BrowserLab {APP_VERSION}", "generated_unix": time.time(),
        "experiment": {k: info.get(k) for k in keys},
        "source_file": source.name, "source_sha256": sha256_file(source),
        "metric": analysis.get("metric"), "metric_label": analysis.get("metric_label"),
        "limitations": list(LIMITATIONS),
    }


def validate_dest(path: str, fmt: str, protected_roots: Iterable[Path]) -> Path:
    if fmt not in FORMATS:
        raise ExportError(f"unknown format {fmt}")
    p = Path(path).expanduser()
    if not p.is_absolute():
        raise ExportError("destination must be an absolute path")
    if p.suffix.lower() != FORMATS[fmt]:
        raise ExportError(f"destination must end with {FORMATS[fmt]}")
    if not p.parent.is_dir():
        raise ExportError("destination folder does not exist")
    real = p.parent.resolve() / p.name
    for root in protected_roots:
        r = root.resolve()
        if real == r or r in real.parents:
            raise ExportError("refusing to write inside an experiment data folder")
    return real


def _atomic_write(dest: Path, data: bytes) -> None:
    tmp = dest.with_name(dest.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, dest)


def csv_trials(summary_csv: Path, prov: dict[str, Any]) -> bytes:
    body = summary_csv.read_bytes()
    head = f"# BrowserLab {APP_VERSION} | experiment={prov['experiment']['id']} | protocol={prov['experiment']['protocol_key']} | source_sha256={prov['source_sha256']}\n"
    return head.encode() + body


CONDITION_COLS = ["browser", "workload", "tabs", "n", "mean", "ci_lo", "ci_hi", "median", "sd", "cv", "p5", "p95"]


def conditions_rows(analysis: dict[str, Any]) -> tuple[list[list[Any]], str]:
    unit = "MB" if analysis.get("metric") else ""
    return [[c.get(k) for k in CONDITION_COLS] for c in analysis["conditions"]], unit


def csv_conditions(analysis: dict[str, Any], prov: dict[str, Any]) -> bytes:
    rows, unit = conditions_rows(analysis)
    buf = io.StringIO()
    buf.write(f"# metric={analysis.get('metric_label')} | protocol={prov['experiment']['protocol_key']} | n_trials={analysis.get('n_trials')}\n")
    w = csv.writer(buf)
    w.writerow([f"{c}_{unit}" if c in ("mean", "ci_lo", "ci_hi", "median", "sd", "p5", "p95") else c for c in CONDITION_COLS])
    for r in rows:
        w.writerow(["" if v is None else v for v in r])
    return buf.getvalue().encode()


def json_bytes(analysis: dict[str, Any], prov: dict[str, Any]) -> bytes:
    return json.dumps({"provenance": prov, "analysis": analysis}, indent=2, allow_nan=False).encode()


def xlsx_bytes(analysis: dict[str, Any], prov: dict[str, Any], summary_csv: Path) -> bytes:
    import pandas as pd
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Provenance"
    exp = prov["experiment"]
    for k, v in [("App", prov["app"]), ("Experiment", exp["id"]), ("Status", exp["status"]), ("Protocol", exp["protocol_key"]),
                 ("Metric", prov["metric_label"]), ("Trials analysed", analysis.get("n_trials")), ("Source file", prov["source_file"]),
                 ("Source SHA-256", prov["source_sha256"]), *[("Limitation", x) for x in prov["limitations"]]]:
        ws.append([k, "" if v is None else str(v)])
    t = wb.create_sheet("Trials")
    df = pd.read_csv(summary_csv)
    t.append(list(df.columns))
    for row in df.itertuples(index=False):
        t.append([None if (isinstance(v, float) and v != v) else v for v in row])
    c = wb.create_sheet("Conditions")
    rows, unit = conditions_rows(analysis)
    c.append([f"{h}_{unit}" if h in ("mean", "ci_lo", "ci_hi", "median", "sd", "p5", "p95") else h for h in CONDITION_COLS])
    for r in rows:
        c.append(r)
    s = wb.create_sheet("Scaling")
    s.append(["browser", "workload", "levels", f"slope_{unit}_per_tab", "slope_lo", "slope_hi", "r2", "note"])
    for e in analysis["scaling"]:
        s.append([e["browser"], e["workload"], ",".join(map(str, e["levels"])), e.get("slope"), e.get("slope_lo"), e.get("slope_hi"), e.get("r2"), e.get("note")])
    a = wb.create_sheet("ANOVA")
    a.append(["model", "term", "df", "F", "p", "partial_eta_sq"])
    for name in ("raw", "log"):
        res = (analysis.get("anova") or {}).get(name)
        for r in (res or {}).get("table", []):
            a.append([name, r["term"], r["df"], r["F"], r["p"], r["partial_eta_sq"]])
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def decode_png(data_url: str) -> bytes:
    prefix = "data:image/png;base64,"
    if not isinstance(data_url, str) or not data_url.startswith(prefix):
        raise ExportError("image must be a PNG data URL")
    try:
        raw = base64.b64decode(data_url[len(prefix):], validate=True)
    except (binascii.Error, ValueError) as e:
        raise ExportError("invalid image encoding") from e
    if len(raw) > MAX_IMAGE_BYTES or not raw.startswith(PNG_MAGIC):
        raise ExportError("invalid or oversized PNG")
    return raw


def pdf_bytes(analysis: dict[str, Any], prov: dict[str, Any], images: list[bytes]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    st = getSampleStyleSheet()
    exp = prov["experiment"]
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, title=f"BrowserLab report {exp['id']}", author=prov["app"],
                            leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm)
    def tbl(data: list[list[Any]], widths: list[float] | None = None) -> Table:
        t = Table([["" if v is None else (f"{v:.4g}" if isinstance(v, float) else str(v)) for v in r] for r in data], colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 7.5), ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e6e8eb")),
                               ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b8bec6")), ("ALIGN", (3, 1), (-1, -1), "RIGHT")]))
        return t
    P = lambda text, style="BodyText": Paragraph(text, st[style])  # noqa: E731
    story: list[Any] = [P("BrowserLab research report", "Title"), P(f"Experiment <b>{exp['id']}</b> ({exp['suite']}) — status: {exp['status']}"),
        P(f"Generated by {prov['app']}. Source file {prov['source_file']} (SHA-256 {prov['source_sha256'][:16]}…)."), Spacer(1, 6),
        P("Methodology", "Heading2"),
        P(f"Browsers: {', '.join(exp['browsers'] or [])}. Workloads: {', '.join(exp['workloads'] or [])}. Tab levels: {exp['tab_levels']}. "
          f"Repetitions: {exp['repetitions']}. Warm-up {exp['warmup_seconds']} s, measurement {exp['measure_seconds']} s. Protocol key: {exp['protocol_key']}."),
        P(f"Trials completed/scheduled: {exp['completed_trials']}/{exp['scheduled_trials']}; analysed: {analysis.get('n_trials')}. "
          f"Metric: {prov['metric_label']}. Each trial uses a cloned baseline profile, randomized blocked order, and process-tree measurement."),
        P("System: " + ", ".join(f"{k}={v}" for k, v in (exp.get("system") or {}).items() if k in ("chip", "macos_version", "memory_gb", "machine"))),
        P("Statistical inference", "Heading2"), P(analysis["inference"]["reason"])]
    for n in analysis.get("notes", []):
        story.append(P(f"Note: {n}"))
    story += [P("Condition summary", "Heading2")]
    rows, unit = conditions_rows(analysis)
    story.append(tbl([[f"{h} ({unit})" if h in ("mean", "ci_lo", "ci_hi", "median", "sd", "p5", "p95") else h for h in CONDITION_COLS], *rows]))
    story += [P("Scaling slopes (linear trend across trials)", "Heading2"),
              tbl([["browser", "workload", f"slope ({unit}/tab)", "CI lo", "CI hi", "R²"],
                   *[[e["browser"], e["workload"], e.get("slope"), e.get("slope_lo"), e.get("slope_hi"), e.get("r2")] for e in analysis["scaling"]]])]
    anova = analysis.get("anova")
    if anova:
        story.append(P("Factorial ANOVA (Type II, trial level)", "Heading2"))
        for name in ("raw", "log"):
            res = anova.get(name)
            if res:
                story += [P(f"{name} scale — residual df {res['df_resid']}"),
                          tbl([["term", "df", "F", "p", "partial η²"], *[[r["term"], r["df"], r["F"], r["p"], r["partial_eta_sq"]] for r in res["table"]]])]
                if res.get("bp"):
                    story.append(P(f"Breusch–Pagan heteroskedasticity p = {res['bp']['p']:.4g}."))
    if images:
        story.append(PageBreak())
        story.append(P("Charts", "Heading2"))
        for raw in images:
            img = Image(io.BytesIO(raw))
            scale = min(1.0, (doc.width) / img.imageWidth)
            img.drawWidth, img.drawHeight = img.imageWidth * scale, img.imageHeight * scale
            story += [img, Spacer(1, 8)]
    story += [P("Limitations", "Heading2"), *[P("• " + x) for x in prov["limitations"]]]
    doc.build(story)
    return out.getvalue()


def write_export(fmt: str, dest: Path, info: dict[str, Any], summary_csv: Path, analysis: dict[str, Any], images: list[str]) -> dict[str, Any]:
    prov = provenance(info, summary_csv, analysis)
    if fmt == "csv_trials":
        data = csv_trials(summary_csv, prov)
    elif fmt == "csv_conditions":
        data = csv_conditions(analysis, prov)
    elif fmt == "json":
        data = json_bytes(analysis, prov)
    elif fmt == "xlsx":
        data = xlsx_bytes(analysis, prov, summary_csv)
    elif fmt == "pdf":
        data = pdf_bytes(analysis, prov, [decode_png(i) for i in images])
    elif fmt == "png":
        if len(images) != 1:
            raise ExportError("png export needs exactly one image")
        data = decode_png(images[0])
    else:
        raise ExportError(f"unknown format {fmt}")
    _atomic_write(dest, data)
    return {"path": str(dest), "bytes": len(data), "format": fmt}
