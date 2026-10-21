import math

from browserbench.runner import (
    _measurement_performance_delta,
)


def test_javascript_delta_rate():
    before = [
        {
            "tab_index": 0,
            "page_perf_ms": 1000.0,
            "bench": {
                "type": "javascript",
                "operations": 1000,
            },
            "video": None,
        },
        {
            "tab_index": 1,
            "page_perf_ms": 2000.0,
            "bench": {
                "type": "javascript",
                "operations": 2000,
            },
            "video": None,
        },
    ]

    after = [
        {
            "tab_index": 0,
            "page_perf_ms": 11000.0,
            "bench": {
                "type": "javascript",
                "operations": 3000,
            },
            "video": None,
        },
        {
            "tab_index": 1,
            "page_perf_ms": 12000.0,
            "bench": {
                "type": "javascript",
                "operations": 6000,
            },
            "video": None,
        },
    ]

    out = _measurement_performance_delta(
        before,
        after,
    )

    assert out["measurement_js_valid_tabs"] == 2
    assert out["measurement_js_operations_delta"] == 6000

    # 2000/10 + 4000/10
    assert (
        out["measurement_js_ops_per_sec_total"]
        == 600
    )

    assert (
        out[
            "measurement_js_ops_per_sec_mean_per_tab"
        ]
        == 300
    )


def test_video_delta_metrics():
    before = [
        {
            "tab_index": 0,
            "page_perf_ms": 1000.0,
            "bench": {
                "type": "video",
            },
            "video": {
                "decodedFrames": 100,
                "droppedFrames": 2,
            },
        }
    ]

    after = [
        {
            "tab_index": 0,
            "page_perf_ms": 11000.0,
            "bench": {
                "type": "video",
            },
            "video": {
                "decodedFrames": 400,
                "droppedFrames": 5,
            },
        }
    ]

    out = _measurement_performance_delta(
        before,
        after,
    )

    assert out["measurement_video_valid_tabs"] == 1

    assert (
        out[
            "measurement_video_decoded_frames_delta"
        ]
        == 300
    )

    assert (
        out[
            "measurement_video_dropped_frames_delta"
        ]
        == 3
    )

    assert (
        out[
            "measurement_video_decoded_fps_total"
        ]
        == 30
    )

    assert math.isclose(
        out["measurement_video_drop_pct"],
        1.0,
    )


def test_negative_counter_is_rejected():
    before = [
        {
            "tab_index": 0,
            "page_perf_ms": 1000.0,
            "bench": {
                "type": "javascript",
                "operations": 5000,
            },
            "video": None,
        }
    ]

    after = [
        {
            "tab_index": 0,
            "page_perf_ms": 11000.0,
            "bench": {
                "type": "javascript",
                "operations": 100,
            },
            "video": None,
        }
    ]

    out = _measurement_performance_delta(
        before,
        after,
    )

    assert out["measurement_js_valid_tabs"] == 0

    assert math.isnan(
        out[
            "measurement_js_ops_per_sec_total"
        ]
    )
