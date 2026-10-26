"""Write config.ci.yaml: config.smoke.yaml with only the browsers found on this machine, shortened timings."""
import os

import yaml

from browserbench.config import load_config

resolved = load_config("config.smoke.yaml")
cfg = yaml.safe_load(open("config.smoke.yaml"))
for name, b in cfg["browsers"].items():
    path = resolved["browsers"][name].get("binary")
    b["enabled"] = bool(path) and os.path.exists(str(path))
    print(name, "enabled" if b["enabled"] else "skipped")
cfg["project"]["output_dir"] = "data_ci"
cfg["core"].update(warmup_seconds=3, measure_seconds=8, cooldown_seconds=2)
with open("config.ci.yaml", "w") as f:
    yaml.safe_dump(cfg, f)
