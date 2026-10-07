from __future__ import annotations

import ctypes
import math
import sys


_MIB = 1024.0 * 1024.0


class _RUsageInfoV0(ctypes.Structure):
    _fields_ = [
        ("ri_uuid", ctypes.c_uint8 * 16),
        ("ri_user_time", ctypes.c_uint64),
        ("ri_system_time", ctypes.c_uint64),
        ("ri_pkg_idle_wkups", ctypes.c_uint64),
        ("ri_interrupt_wkups", ctypes.c_uint64),
        ("ri_pageins", ctypes.c_uint64),
        ("ri_wired_size", ctypes.c_uint64),
        ("ri_resident_size", ctypes.c_uint64),
        ("ri_phys_footprint", ctypes.c_uint64),
        ("ri_proc_start_abstime", ctypes.c_uint64),
        ("ri_proc_exit_abstime", ctypes.c_uint64),
    ]


_libproc = None

if sys.platform == "darwin":
    try:
        _libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)

        _libproc.proc_pid_rusage.argtypes = [
            ctypes.c_int,
            ctypes.c_int,
            ctypes.c_void_p,
        ]
        _libproc.proc_pid_rusage.restype = ctypes.c_int
    except OSError:
        _libproc = None


def phys_footprint_mb(pid: int) -> float:
    """
    macOS physical footprint for one process in MiB.

    Returns NaN when unavailable.
    """
    if _libproc is None:
        return math.nan

    info = _RUsageInfoV0()

    rc = _libproc.proc_pid_rusage(
        int(pid),
        0,  # RUSAGE_INFO_V0
        ctypes.byref(info),
    )

    if rc != 0:
        return math.nan

    return float(info.ri_phys_footprint) / _MIB
