import React, { useState, useMemo, useEffect } from "react";
import axios from "axios";
import { BASE_URL } from "../../config/envvar";
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TablePagination,
  TextField,
  Select,
  MenuItem,
  Drawer,
  Tooltip,
} from "@mui/material";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import { Skeleton } from "@mui/material";
import { AgChartsReact } from "ag-charts-react";
import * as XLSX from "xlsx";

// ======================== 공통 상수 ======================== //
const DEBUG = false;
const JUDGE_OK = "OK";
const JUDGE_NG = "NG";

const CHART_CONSTANTS = {
  STICK_SLIP_BASE_TEMP: 10,
  STICK_SLIP_MAX_TEMP: 50,
  STICK_SLIP_PRE_WARM_MINS: 5,
  STICK_SLIP_SATURATION_TIME: 30,
};

const STICK_SLIP_SPEC = {
  count: {
    description: "Number of stick-slip noise occurrences by SPL range",

    byDuration: {
      "1min": {
        "25~45": 5,
        "35~45": 1,
        ">=45": 0,
      },
      "30min": {
        "25~45": 15,
        "35~45": 3,
        ">=45": 0,
      },
      "60min": {
        "25~45": 25,
        "35~45": 5,
        ">=45": 0,
      },
    },
  },

  boolean: {
    description:
      "Checks for three or more consecutive noise events (≥25dB) at 5-second intervals.",
    expectedResult: "OK",
  },
};

// Stick-Slip TC_ID → SPL Range
const TC_ID_TO_SPL_RANGE = {
  // 25~45
  "H22-101-0002": "25~45", //WarmUp 1min
  "H22-101-0003": "25~45", //WarmUp 30min
  "H22-101-0004": "25~45", //WarmUp 1hour
  "H22-101-0011": "25~45", //CoolDown 1min
  "H22-101-0012": "25~45", //CoolDown 30min
  "H22-101-0013": "25~45", //CoolDown 1hour

  // 35~45
  "H22-101-0005": "35~45", //WarmUp 1min
  "H22-101-0006": "35~45", //WarmUp 30min
  "H22-101-0007": "35~45", //WarmUp 1hour
  "H22-101-0014": "35~45", //CoolDown 1min
  "H22-101-0015": "35~45", //CoolDown 30min
  "H22-101-0016": "35~45", //CoolDown 1hour

  // over_45
  "H22-101-0008": ">=45", //WarmUp 30min
  "H22-101-0017": ">=45", //CoolDown 30min
};

const SOUND_VIBRATION_SPEC = {
  margin: {
    description: "Measured value should be greater than or equal to Spec_Min",
    condition: "min",
    exclude: ["H22-105-0002"], // REF 제외
  },
  limit: {
    description: "Measured value should be less than or equal to Spec_Max",
    condition: "max",
    exclude: ["H22-105-0009", "H22-105-0010"], // REF 제외
  },
  total: {
    description: "Overall SV judgment (Cpk)",
    tcId: "H22-105-0016",
    condition: "min",
  },
};

const SV_FREQ_META = {
  // ===== Margin =====
  "H22-105-0002": { freq: "63~129", type: "margin", isRef: true },
  "H22-105-0003": { freq: "130~199", type: "margin", isRef: false },
  "H22-105-0004": { freq: "200~399", type: "margin", isRef: false },
  "H22-105-0005": { freq: "400~599", type: "margin", isRef: false },
  "H22-105-0006": { freq: "600~799", type: "margin", isRef: false },
  "H22-105-0007": { freq: "800~999", type: "margin", isRef: false },

  // ===== Limit =====
  "H22-105-0009": { freq: "63~129", type: "limit", isRef: true },
  "H22-105-0010": { freq: "130~199", type: "limit", isRef: true },
  "H22-105-0011": { freq: "200~399", type: "limit", isRef: false },
  "H22-105-0012": { freq: "400~599", type: "limit", isRef: false },
  "H22-105-0013": { freq: "600~799", type: "limit", isRef: false },
  "H22-105-0014": { freq: "800~999", type: "limit", isRef: false },
};

// ======================== 공통 함수 ======================== //
function darkenColor(hex, amount = 0.15) {
  let col = hex.replace("#", "");
  let num = parseInt(col, 16);

  let r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  let g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  let b = Math.max(0, (num & 0xff) * (1 - amount));

  return `rgb(${r}, ${g}, ${b})`;
}

function parseInchFromModel(model) {
  if (!model || typeof model !== "string") return null;

  const oledMatch = model.match(/OLED(2[4-9]|[3-9]\d|1[0-1]\d)/);
  if (oledMatch) return Number(oledMatch[1]);

  const lcdMatch = model.match(/^(2[4-9]|[3-9]\d|1[0-1]\d)/);
  if (lcdMatch) return Number(lcdMatch[1]);
}

function getCorrectedTC_ID({ tcId, mode, duration }) {
  // WarmUp
  if (mode === "WarmUp") {
    if (tcId === "H22-101-0002") {
      return duration === "60min" ? "H22-101-0004" : "H22-101-0003";
    }
    if (tcId === "H22-101-0005") {
      return duration === "60min" ? "H22-101-0007" : "H22-101-0006";
    }
  }

  // CoolDown
  if (mode === "CoolDown") {
    if (tcId === "H22-101-0011") {
      return "H22-101-0012";
    }
    if (tcId === "H22-101-0014") {
      return "H22-101-0015";
    }
  }

  // over_45 or 정상 TC는 그대로
  return tcId;
}

function normalizeItem(item) {
  if (!item) return item;

  if (item === "Stic-Slip") return "Stick-Slip";

  return item;
}

function calculateSampleCount(model_PK, sample_list) {
  const rows = sample_list.filter(
    (s) => s.Model_PK === model_PK && s.Sample_No !== "Summary"
  );

  const totalSamples = new Set(rows.map((s) => s.Sample_No)).size;

  const stickSlipSamples = new Set(
    rows
      .filter((s) => normalizeItem(s.Item) === "Stick-Slip")
      .map((s) => s.Sample_No)
  ).size;

  const soundVibrationSamples = new Set(
    rows.filter((s) => s.Item === "Sound Vibration").map((s) => s.Sample_No)
  ).size;

  return {
    total: totalSamples,
    stick_slip: stickSlipSamples,
    sound_vibration: soundVibrationSamples,
  };
}

function hasStickSlip(model) {
  return model.sample_count.stick_slip > 0;
}

function hasSoundVibration(model) {
  return model.sample_count.sound_vibration > 0;
}

function getWarmupTime(model) {
  // if (!model) return null;

  const isOver65 = model.inch >= 65;
  const isFullBackCover = model.isFullBackCover === true;

  return isOver65 || isFullBackCover ? 60 : 30;
}

function getStickSlipDurationByMode(model, mode) {
  if (!model) return null;

  if (mode === "WarmUp") {
    return getWarmupTime(model) === 60 ? "60min" : "30min";
  }

  return "30min";
}

// ======================== Domain Layer ======================== //
function analyzeStickSlipSample({ model, sampleNo, bigData }) {
  const warmUp = analyzeStickSlipMode({
    model,
    sampleNo,
    bigData,
    mode: "WarmUp",
  });

  const coolDown = analyzeStickSlipMode({
    model,
    sampleNo,
    bigData,
    mode: "CoolDown",
  });

  const sampleOverallJudge =
    warmUp.overallJudge === JUDGE_OK && coolDown.overallJudge === JUDGE_OK
      ? JUDGE_OK
      : JUDGE_NG;

  return {
    sampleNo,
    sampleOverallJudge,
    warmUp,
    coolDown,
  };
}

function analyzeStickSlipMode({ model, sampleNo, bigData, mode }) {
  const duration = getStickSlipDurationByMode(model, mode);
  const specBySpl = STICK_SLIP_SPEC.count.byDuration[duration];

  if (!specBySpl) {
    return {
      duration,
      splDetails: [],
      splOverallJudge: JUDGE_NG,
      consecutiveNoiseJudge: JUDGE_NG,
      overallJudge: JUDGE_NG,
    };
  }

  const rows = bigData.filter(
    (r) =>
      r.Model_PK === model.id &&
      r.Sample === sampleNo &&
      r.TC_ID.startsWith("H22-101-") &&
      (mode === "WarmUp"
        ? r.Test_Name.includes("WarmUP")
        : r.Test_Name.includes("CoolDown"))
  );

  const measuredCountBySpl = {};

  for (const row of rows) {
    const correctedTcId = getCorrectedTC_ID({
      tcId: row.TC_ID,
      mode,
      duration,
    });

    const splRange = TC_ID_TO_SPL_RANGE[correctedTcId];
    if (!splRange) continue;

    measuredCountBySpl[splRange] = Math.max(
      measuredCountBySpl[splRange] ?? 0,
      Number(row.Result)
    );
  }

  const splDetails = Object.keys(specBySpl).map((splRange) => {
    const measuredCount = measuredCountBySpl[splRange] ?? 0;
    const specLimit = specBySpl[splRange];
    const judge = measuredCount > specLimit ? JUDGE_NG : JUDGE_OK;

    return {
      splRange,
      measuredCount,
      specLimit,
      judge,
    };
  });

  const splOverallJudge = splDetails.some((row) => row.judge === JUDGE_NG)
    ? JUDGE_NG
    : JUDGE_OK;

  const consecutiveNoiseJudge = judgeConsecutiveNoiseByMode({
    model,
    sampleNo,
    bigData,
    mode,
  });

  const overallJudge =
    splOverallJudge === JUDGE_OK && consecutiveNoiseJudge === JUDGE_OK
      ? JUDGE_OK
      : JUDGE_NG;

  return {
    duration,
    splDetails,
    splOverallJudge,
    consecutiveNoiseJudge,
    overallJudge,
  };
}

function analyzeSoundVibrationSample({ model, sampleNo, bigData }) {
  const rows = bigData.filter(
    (r) =>
      r.Model_PK === model.id &&
      r.Sample === sampleNo &&
      r.TC_ID.startsWith("H22-105-")
  );

  const marginResults = [];
  const limitResults = [];

  // -----------------------
  // 1) Margin (>= Spec_Min)
  // -----------------------
  rows.forEach((row) => {
    if (
      row.TC_ID >= "H22-105-0002" &&
      row.TC_ID <= "H22-105-0008" &&
      !SOUND_VIBRATION_SPEC.margin.exclude.includes(row.TC_ID)
    ) {
      const measured = Number(row.Result);
      const specMin = Number(row.Spec_Min);

      const judge =
        !isNaN(measured) && !isNaN(specMin) && measured >= specMin
          ? JUDGE_OK
          : JUDGE_NG;

      marginResults.push({
        tcId: row.TC_ID,
        name: row.Test_Name,
        measured,
        spec: specMin,
        judge,
      });
    }
  });

  // -----------------------
  // 2) Limit (<= Spec_Max)
  // -----------------------
  rows.forEach((row) => {
    if (
      row.TC_ID >= "H22-105-0009" &&
      row.TC_ID <= "H22-105-0015" &&
      !SOUND_VIBRATION_SPEC.limit.exclude.includes(row.TC_ID)
    ) {
      const measured = Number(row.Result);
      const specMax = Number(row.Spec_Max);

      const judge =
        !isNaN(measured) && !isNaN(specMax) && measured <= specMax
          ? JUDGE_OK
          : JUDGE_NG;

      limitResults.push({
        tcId: row.TC_ID,
        name: row.Test_Name,
        measured,
        spec: specMax,
        judge,
      });
    }
  });

  // -----------------------
  // 3) Total (Cpk)
  // -----------------------
  const totalRow = rows.find(
    (r) => r.TC_ID === SOUND_VIBRATION_SPEC.total.tcId
  );

  let totalJudge = JUDGE_NG;

  if (totalRow) {
    const measured = Number(totalRow.Result);
    const specMin = Number(totalRow.Spec_Min);

    totalJudge =
      !isNaN(measured) && !isNaN(specMin) && measured >= specMin
        ? JUDGE_OK
        : JUDGE_NG;
  }

  // Overall
  const overallJudge =
    [...marginResults, ...limitResults].some((r) => r.judge === JUDGE_NG) ||
    totalJudge === JUDGE_NG
      ? JUDGE_NG
      : JUDGE_OK;

  return {
    marginResults,
    limitResults,
    totalJudge,
    overallJudge,
  };
}

function buildSoundVibrationAnalysis({ model, sampleNo, bigData }) {
  const rows = bigData.filter(
    (r) =>
      r.Model_PK === model.id &&
      r.Sample === sampleNo &&
      r.TC_ID.startsWith("H22-105-")
  );

  // ------------------------
  // 1) Margin
  // ------------------------
  const marginItems = rows
    .filter(
      (r) =>
        r.TC_ID >= "H22-105-0002" &&
        r.TC_ID <= "H22-105-0008" &&
        r.TC_ID !== "H22-105-0002" // REF 제외
    )
    .map((r) => {
      const measured = Number(r.Result);
      const spec = Number(r.Spec_Min);

      const judge =
        !isNaN(measured) && !isNaN(spec) && measured >= spec
          ? JUDGE_OK
          : JUDGE_NG;

      return {
        tcId: r.TC_ID,
        name: r.Test_Name,
        measured,
        spec,
        judge,
      };
    });

  const marginOverall = marginItems.some((i) => i.judge === JUDGE_NG)
    ? JUDGE_NG
    : JUDGE_OK;

  // ------------------------
  // 2) Limit
  // ------------------------
  const limitItems = rows
    .filter(
      (r) =>
        r.TC_ID >= "H22-105-0009" &&
        r.TC_ID <= "H22-105-0015" &&
        r.TC_ID !== "H22-105-0009" &&
        r.TC_ID !== "H22-105-0010" // REF 제외
    )
    .map((r) => {
      const measured = Number(r.Result);
      const spec = Number(r.Spec_Max);

      const judge =
        !isNaN(measured) && !isNaN(spec) && measured <= spec
          ? JUDGE_OK
          : JUDGE_NG;

      return {
        tcId: r.TC_ID,
        name: r.Test_Name,
        measured,
        spec,
        judge,
      };
    });

  const limitOverall = limitItems.some((i) => i.judge === JUDGE_NG)
    ? JUDGE_NG
    : JUDGE_OK;

  // ------------------------
  // 3) TOTAL (Cpk)
  // ------------------------
  const totalRow = rows.find((r) => r.TC_ID === "H22-105-0016");

  let total = null;

  if (totalRow) {
    const value = Number(totalRow.Result);
    const spec = Number(totalRow.Spec_Min);

    const judge =
      !isNaN(value) && !isNaN(spec) && value >= spec ? JUDGE_OK : JUDGE_NG;

    total = {
      value,
      spec,
      judge,
      comment: totalRow.Judge_Comment,
    };
  }

  // ------------------------
  // 4) OVERALL
  // ------------------------
  const overallJudge =
    marginOverall === JUDGE_OK && limitOverall === JUDGE_OK
      ? JUDGE_OK
      : JUDGE_NG;

  // console.log("SV sample judge debug:", {
  //   sampleNo,
  //   marginOverall,
  //   limitOverall,
  //   total,
  //   overallJudge,
  //   marginItems,
  //   limitItems,
  // });

  return {
    sampleNo,
    overallJudge,

    margin: {
      items: marginItems,
      overallJudge: marginOverall,
    },

    limit: {
      items: limitItems,
      overallJudge: limitOverall,
    },

    total,
  };
}

function buildSoundVibrationSummary({ model, bigData, samples }) {
  // -------------------------
  // 1) Sample별 결과 만들기
  // -------------------------
  const sampleResults = samples.map((sampleNo) =>
    buildSoundVibrationAnalysis({
      model,
      sampleNo,
      bigData,
    })
  );

  const total = sampleResults.length;

  const ok = sampleResults.filter((r) => r.overallJudge === JUDGE_OK).length;

  const ng = total - ok;

  // -------------------------
  // 2) CPK (TC: 0016)
  // -------------------------
  const cpkRow = bigData.find(
    (r) => r.Model_PK === model.id && r.TC_ID === "H22-105-0016"
  );

  let cpk = null;

  if (cpkRow) {
    const value = Number(cpkRow.Result);
    const spec = Number(cpkRow.Spec_Min);

    const judge =
      !isNaN(value) && !isNaN(spec) && value >= spec ? JUDGE_OK : JUDGE_NG;

    cpk = {
      value,
      spec,
      judge,
      comment: cpkRow.Judge_Comment,
    };
  }

  return {
    total,
    ok,
    ng,
    cpk,
  };
}

// ======================== Data Layer ======================== //
function judgeConsecutiveNoiseByMode({ model, sampleNo, bigData, mode }) {
  const targetTcId = mode === "WarmUp" ? "H22-101-0009" : "H22-101-0018";

  const row = bigData.find(
    (r) =>
      r.Model_PK === model.id && r.Sample === sampleNo && r.TC_ID === targetTcId
  );

  if (!row) return JUDGE_NG;

  return row.Result === STICK_SLIP_SPEC.boolean.expectedResult
    ? JUDGE_OK
    : JUDGE_NG;
}

const testCaseButtonSx = (enabled, baseColor) => ({
  minWidth: 30,
  height: 24,
  px: 1,

  borderRadius: "11px",
  border: `1px solid ${baseColor}`,

  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.3px",

  color: enabled ? "#fff" : "#aaa",
  backgroundColor: enabled ? baseColor : "#f1f1f1",

  boxShadow: enabled ? "0 1px 3px rgba(0,0,0,0.25)" : "none",

  cursor: enabled ? "pointer" : "not-allowed",
  opacity: enabled ? 1 : 0.5,

  transition: "all 0.15s ease",

  "&:hover": enabled
    ? {
        backgroundColor: darkenColor(baseColor, 0.12),
        boxShadow: "0 3px 6px rgba(0,0,0,0.35)",
        transform: "translateY(-1px)",
      }
    : {},

  "&:active": enabled
    ? {
        transform: "translateY(0)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      }
    : {},
});

const filterInputSx = {
  height: 26,

  "& .MuiInputBase-root": {
    height: 26,
    fontSize: 13,
  },

  "& .MuiInputBase-input": {
    padding: "0px 6px",
    height: "26px",
    boxSizing: "border-box",
    fontSize: 13,
  },

  "& .MuiSelect-select": {
    padding: "4px 6px",
    height: "26px",
    boxSizing: "border-box",
    fontSize: 13,
  },
};

/**
 * Area Series를 위한 구간별 온도 데이터를 생성하는 함수
 * @param {number} warmupMins - Warm-up 시간(분)
 * @param {number} cooldownMins - Cool-down 시간(분)
 * @returns {Array<Object>} - 각 데이터 포인트는 모든 시리즈 값을 가짐
 */
function generateAreaData(warmupMins, cooldownMins, tailMins) {
  const data = [];
  const baseTemp = CHART_CONSTANTS.STICK_SLIP_BASE_TEMP;
  const maxTemp = CHART_CONSTANTS.STICK_SLIP_MAX_TEMP;

  const preWarm = CHART_CONSTANTS.STICK_SLIP_PRE_WARM_MINS;
  const warmupStart = preWarm;
  const warmupEnd = warmupStart + warmupMins;
  const saturationMins = CHART_CONSTANTS.STICK_SLIP_SATURATION_TIME;
  const powerOffTime = warmupEnd + saturationMins;
  const cooldownEnd = powerOffTime + cooldownMins;
  const totalTime = cooldownEnd + tailMins;

  for (let t = 0; t <= totalTime; t++) {
    let idle;
    let warmup;
    let saturation;
    let cooldown;

    // PRE‑WARM (Base Temp 유지)
    if (t < warmupStart) {
      idle = baseTemp;
    }

    // Warm‑Up (base → max)
    else if (t >= warmupStart && t <= warmupEnd) {
      warmup =
        baseTemp + ((maxTemp - baseTemp) * (t - warmupStart)) / warmupMins;
    }

    // Saturation
    else if (t > warmupEnd && t <= powerOffTime) {
      saturation = maxTemp;
    }

    // Cool‑Down (max → base)
    else if (t > powerOffTime && t <= cooldownEnd) {
      cooldown =
        baseTemp +
        (maxTemp - baseTemp) * (1 - (t - powerOffTime) / cooldownMins);
    }

    // Post Idle
    else {
      idle = baseTemp;
    }

    // 연결 브리지
    if (t === warmupStart) idle = baseTemp;
    if (t === warmupEnd) saturation = maxTemp;
    if (t === powerOffTime) cooldown = maxTemp;
    if (t === cooldownEnd) {
      cooldown = baseTemp;
      idle = baseTemp;
    }

    data.push({
      time: t,
      idle,
      warmup,
      saturation,
      cooldown,
    });
  }

  // 차트 끝까지 flat 유지
  data.push({
    time: totalTime + 1,
    idle: baseTemp,
  });

  return data;
}

function verticalLineData(x, maxY) {
  return [
    { x, y: 0 },
    { x, y: maxY },
  ];
}

function JudgePill({ value }) {
  const isNg = value === JUDGE_NG;

  return (
    <Box
      sx={{
        minWidth: 64,
        height: 28,
        px: 1.5,
        borderRadius: "999px",
        // display: "inline-flex",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 700,
        color: isNg ? "#fff" : "#0b57d0",
        backgroundColor: isNg ? "#E5533D" : "#EAF2FF",
        border: isNg ? "1px solid #E5533D" : "1px solid #BFD5FF",
      }}
    >
      {value}
    </Box>
  );
}

function DurationCircleRow({
  selectedDuration,
  circleStyle,
  highlightedCircleStyle,
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-around" }}>
      <Box
        sx={{
          ...circleStyle,
          ...(selectedDuration === "30min" && highlightedCircleStyle),
        }}
      >
        30
      </Box>
      <Box
        sx={{
          ...circleStyle,
          ...(selectedDuration === "60min" && highlightedCircleStyle),
        }}
      >
        60
      </Box>
    </Box>
  );
}

function SplDetailGrid({ splDetails, ngStyle }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr 0.8fr 0.8fr 0.8fr",
        border: "1px solid #ddd",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      {["SPL", "Count", "Spec", "Judge"].map((label) => (
        <Box
          key={label}
          sx={{
            p: 1,
            textAlign: "center",
            fontWeight: 700,
            backgroundColor: "#f8f9fb",
            borderBottom: "1px solid #ddd",
          }}
        >
          {label}
        </Box>
      ))}

      {splDetails.map((row, idx) => {
        const isLast = idx === splDetails.length - 1;
        return (
          <React.Fragment key={row.splRange}>
            <Box
              sx={{
                p: 1,
                textAlign: "center",
                borderRight: "1px solid #ddd",
                borderBottom: isLast ? "none" : "1px solid #ddd",
              }}
            >
              {row.splRange.replace("~", "-")}dB
            </Box>

            <Box
              sx={{
                p: 1,
                textAlign: "center",
                borderRight: "1px solid #ddd",
                borderBottom: isLast ? "none" : "1px solid #ddd",
              }}
            >
              {row.measuredCount}
            </Box>

            <Box
              sx={{
                p: 1,
                textAlign: "center",
                borderRight: "1px solid #ddd",
                borderBottom: isLast ? "none" : "1px solid #ddd",
              }}
            >
              {`≤ ${row.specLimit}`}
            </Box>

            <Box
              sx={{
                p: 1,
                textAlign: "center",
                borderBottom: isLast ? "none" : "1px solid #ddd",
                ...(row.judge === JUDGE_NG ? ngStyle : {}),
              }}
            >
              {row.judge}
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
}

function DetailDrawerHeader({
  selectedTestCase,
  selectedModel,
  testCaseColorMap,
  onClose,
}) {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
          Measurement Detail
        </Typography>

        <Button
          variant="text"
          size="small"
          onClick={onClose}
          sx={{
            minWidth: 32,
            px: 1,
            fontSize: 18,
            color: "#666",
          }}
        >
          ✕
        </Button>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 1.5,
        }}
      >
        <Box sx={{ fontSize: 14 }}>
          <Box
            component="span"
            sx={{
              color: testCaseColorMap[selectedTestCase],
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            {selectedTestCase}
          </Box>
          <Box component="span" sx={{ mx: 0.75, color: "#999" }}>
            |
          </Box>
          <Box component="span">
            {selectedModel.model}_{selectedModel.grade}_{selectedModel.event}
          </Box>
        </Box>

        <Typography variant="body2" sx={{ color: "#555", textAlign: "right" }}>
          {selectedModel.user} · {selectedModel.measured_time}
        </Typography>
      </Box>
    </Box>
  );
}

function DetailSummarySection({
  summary,
  samplesForDetail,
  pieOptions,
  okSamples,
  ngSamples,
  svSummary,
  isSoundVibration,
}) {
  const summaryItems = [
    {
      label: "Total Samples",
      value: samplesForDetail.length,
      bg: "#ffffff",
      color: "#000",
      tooltip: samplesForDetail.join(", ") || "No samples",
    },
    {
      label: "OK",
      value: isSoundVibration ? svSummary?.ok ?? 0 : summary.ok,
      bg: "#EAF2FF",
      color: "#4A90E2",
      tooltip: okSamples.join(", ") || "No OK samples",
    },
    {
      label: "NG",
      value: isSoundVibration ? svSummary?.ng ?? 0 : summary.ng,
      bg: "#FDEDEC",
      color: "#E5533D",
      tooltip: ngSamples.join(", ") || "No NG samples",
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        gap: 3,
        alignItems: "center",
        py: 1,
      }}
    >
      {/* ================= PIE ================= */}
      <Box
        sx={{ width: 160, height: 160, position: "relative", flexShrink: 0 }}
      >
        <AgChartsReact options={pieOptions} />
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <Typography variant="caption" sx={{ color: "#777" }}>
            Total
          </Typography>
          <Typography variant="h6" fontWeight={700}>
            {samplesForDetail.length}
          </Typography>
        </Box>
      </Box>
      {/* ================= KPI ================= */}
      <Box
        sx={{
          display: "flex",
          gap: 2, // KPI vs CPK 간격
          flex: 1,
        }}
      >
        {/* KPI */}
        <Box
          sx={{ display: "flex", flexDirection: "column", gap: 1.25, flex: 1 }}
        >
          {summaryItems.map((item) => (
            <Box
              key={item.label}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #e5e7eb",
                borderRadius: 2,
                px: 1.5,
                py: 1.25,
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {item.label}
              </Typography>

              <Tooltip title={item.tooltip} arrow placement="left">
                <Box
                  sx={{
                    minWidth: 32,
                    height: 32,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    backgroundColor: item.bg,
                    color: item.color,
                    border: "1px solid #d1d5db",
                  }}
                >
                  {item.value}
                </Box>
              </Tooltip>
            </Box>
          ))}
        </Box>

        {/* ===== CPK KPI 카드 (SV일 때만) ===== */}
        {isSoundVibration && svSummary?.cpk && (
          <Box
            sx={{
              flex: "0 0 300px",
              minWidth: 240,
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              px: 1.5,
              py: 1.5,
              backgroundColor:
                svSummary.cpk.judge === JUDGE_NG ? "#FFF5F5" : "#fafbfc",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 1,
              }}
            >
              {/* 제목 */}
              <Typography fontWeight={700}>CPK Min Value</Typography>
              {/* 판정 결과 */}
              <JudgePill value={svSummary.cpk.judge} />
            </Box>

            {/* 값 */}
            <Typography
              sx={{
                fontSize: 44,
                fontWeight: 700,
                color: svSummary.cpk.judge === JUDGE_NG ? "#E5533D" : "#4A90E2",

                mt: -2, // 위쪽 여백
              }}
            >
              {svSummary.cpk.value.toFixed(3)}
            </Typography>

            {/* 기준 */}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
              <Typography
                variant="caption"
                sx={{ fontSize: 14, color: "#666" }}
              >
                Frequency Range: 130~1kHz
              </Typography>

              <Typography
                variant="caption"
                sx={{ fontSize: 14, color: "#666" }}
              >
                CPK Spec ≥ {svSummary.cpk.spec}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function DetailSampleSelectorSection({
  selectedSample,
  setSelectedSample,
  samplesForDetail,
  sampleResultMap,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        mb: 1,
      }}
    >
      <Typography fontWeight={600}>Sample :</Typography>

      <TextField
        select
        size="small"
        label="Sample"
        value={selectedSample}
        onChange={(e) => setSelectedSample(e.target.value)}
        sx={{ width: 220 }}
      >
        <MenuItem value="">
          <em>Select Sample</em>
        </MenuItem>

        {samplesForDetail.map((sample) => {
          const result = sampleResultMap[sample];

          return (
            <MenuItem
              key={sample}
              value={sample}
              sx={{
                color: result === JUDGE_NG ? "#E5533D" : "inherit",
                fontWeight: result === JUDGE_NG ? 700 : 400,
              }}
            >
              {sample}
              {result === JUDGE_NG ? " (NG)" : ""}
            </MenuItem>
          );
        })}
      </TextField>
    </Box>
  );
}

function TemperatureProfileSection({
  chartWrapRef,
  selectedModel,
  selectedSample,
  chartOptions,
  isChartLayoutReady,
  chartMeta,
  getPlotX,
  getSpanWidth,
  powerLabelTop,
  phaseSpanTop,
  cardSx,
}) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#fafbfc",
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Temperature Profile
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box ref={chartWrapRef} sx={{ height: 250, position: "relative" }}>
          <AgChartsReact
            key={`${selectedModel?.id}-${selectedSample}`}
            options={chartOptions}
          />

          {isChartLayoutReady && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              {/* Power ON */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${getPlotX(chartMeta.warmupStart)}px`,
                  top: `${powerLabelTop}px`,
                  transform: "translateX(-50%)",
                  px: 1.25,
                  py: 0.4,
                  border: "1px solid #777",
                  borderRadius: "999px",
                  backgroundColor: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#333",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                }}
              >
                Power ON
              </Box>

              {/* Power OFF */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${getPlotX(chartMeta.powerOffTime)}px`,
                  top: `${powerLabelTop}px`,
                  transform: "translateX(-50%)",
                  px: 1.25,
                  py: 0.4,
                  border: "1px solid #777",
                  borderRadius: "999px",
                  backgroundColor: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#333",
                  whiteSpace: "nowrap",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                }}
              >
                Power OFF
              </Box>

              {/* Warm-up span */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${getPlotX(chartMeta.warmupStart)}px`,
                  width: `${getSpanWidth(
                    chartMeta.warmupStart,
                    chartMeta.warmupEnd
                  )}px`,
                  top: `${phaseSpanTop}px`,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    height: 0,
                    borderTop: "2px solid #E5533D",
                    position: "relative",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: -1,
                      top: -5,
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderRight: "8px solid #E5533D",
                    },
                  }}
                />
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#333",
                    whiteSpace: "nowrap",
                    backgroundColor: "rgba(255,255,255,0.92)",
                  }}
                >
                  Warming Up ({chartMeta.warmupMins} min)
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    height: 0,
                    borderTop: "2px solid #E5533D",
                    position: "relative",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      right: -1,
                      top: -5,
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderLeft: "8px solid #E5533D",
                    },
                  }}
                />
              </Box>

              {/* Cool-down span */}
              <Box
                sx={{
                  position: "absolute",
                  left: `${getPlotX(chartMeta.powerOffTime)}px`,
                  width: `${getSpanWidth(
                    chartMeta.powerOffTime,
                    chartMeta.endTime
                  )}px`,
                  top: `${phaseSpanTop}px`,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    height: 0,
                    borderTop: "2px solid #4A90E2",
                    position: "relative",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      left: -1,
                      top: -5,
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderRight: "8px solid #4A90E2",
                    },
                  }}
                />
                <Box
                  sx={{
                    px: 1,
                    py: 0.2,
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#333",
                    whiteSpace: "nowrap",
                    backgroundColor: "rgba(255,255,255,0.92)",
                  }}
                >
                  Cool Down ({chartMeta.cooldownMins} min)
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    height: 0,
                    borderTop: "2px solid #4A90E2",
                    position: "relative",
                    "&::after": {
                      content: '""',
                      position: "absolute",
                      right: -1,
                      top: -5,
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderLeft: "8px solid #4A90E2",
                    },
                  }}
                />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

function StickSlipAnalysisSection({
  selectedSample,
  selectedSampleAnalysis,
  circleStyle,
  highlightedCircleStyle,
  ngStyle,
  cardSx,
}) {
  return (
    <Paper variant="outlined" sx={cardSx}>
      {/* 카드 헤더 */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#fafbfc",
        }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          Stick-Slip Analysis
        </Typography>

        <Typography variant="body2" sx={{ color: "#666", mt: 0.25 }}>
          Sample {selectedSample} · Overall Result{" "}
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              color:
                selectedSampleAnalysis.sampleOverallJudge === JUDGE_NG
                  ? "#E5533D"
                  : "#4A90E2",
            }}
          >
            {selectedSampleAnalysis.sampleOverallJudge}
          </Box>
        </Typography>
      </Box>

      <Table
        size="small"
        sx={{
          tableLayout: "fixed",
          "& .MuiTableCell-root": {
            borderColor: "#ddd",
            verticalAlign: "top",
            p: 2,
            fontSize: 13,
          },
        }}
      >
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f7f8fa" }}>
            <TableCell align="center" sx={{ width: "28%", fontWeight: 700 }}>
              Item
            </TableCell>
            <TableCell align="center" sx={{ width: "36%", fontWeight: 700 }}>
              Warm-Up
            </TableCell>
            <TableCell align="center" sx={{ width: "36%", fontWeight: 700 }}>
              Cool-Down
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {/* 1) Time Duration */}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>
              Time Duration
              <br />
              (min)
            </TableCell>

            <TableCell>
              <DurationCircleRow
                selectedDuration={selectedSampleAnalysis.warmUp.duration}
                circleStyle={circleStyle}
                highlightedCircleStyle={highlightedCircleStyle}
              />
            </TableCell>

            <TableCell>
              <DurationCircleRow
                selectedDuration={selectedSampleAnalysis.coolDown.duration}
                circleStyle={circleStyle}
                highlightedCircleStyle={highlightedCircleStyle}
              />
            </TableCell>
          </TableRow>

          {/* 2) Noise Events by SPL */}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Noise Events by SPL</TableCell>

            <TableCell>
              <SplDetailGrid
                splDetails={selectedSampleAnalysis.warmUp.splDetails}
                ngStyle={ngStyle}
              />
            </TableCell>

            <TableCell>
              <SplDetailGrid
                splDetails={selectedSampleAnalysis.coolDown.splDetails}
                ngStyle={ngStyle}
              />
            </TableCell>
          </TableRow>

          {/* 3) Consecutive Noise */}
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  Consecutive Noise
                </Typography>

                <Tooltip title="Checks for three or more consecutive noise events (≥25dB) at 5-second intervals.">
                  <Box
                    component="span"
                    sx={{
                      cursor: "help",
                      color: "#888",
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    ⓘ
                  </Box>
                </Tooltip>
              </Box>
            </TableCell>

            <TableCell align="center">
              <JudgePill
                value={selectedSampleAnalysis.warmUp.consecutiveNoiseJudge}
              />
            </TableCell>

            <TableCell align="center">
              <JudgePill
                value={selectedSampleAnalysis.coolDown.consecutiveNoiseJudge}
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Paper>
  );
}

function buildFullFreqMap(rows, targetType, model, sampleNo, bigData) {
  const map = {};

  // 1. 기본 구조 생성
  Object.entries(SV_FREQ_META)
    .filter(([_, meta]) => meta.type === targetType)
    .forEach(([tcId, meta]) => {
      map[meta.freq] = {
        measured: null,
        spec: null,
        judge: null,
        isRef: meta.isRef,
      };
    });

  // 2. 일반 데이터 채우기 (Non-REF)
  rows.forEach((r) => {
    const meta = SV_FREQ_META[r.tcId];
    if (!meta || meta.type !== targetType) return;

    map[meta.freq] = {
      measured: r.measured,
      spec: r.spec,
      judge: r.judge,
      isRef: meta.isRef,
    };
  });

  // 3. REF 처리 (핵심 수정)
  Object.entries(SV_FREQ_META).forEach(([tcId, meta]) => {
    if (!meta.isRef || meta.type !== targetType) return;

    const row = bigData.find(
      (r) =>
        Number(r.Model_PK) === Number(model.id) &&
        String(r.Sample) === String(sampleNo) &&
        r.TC_ID === tcId
    );

    if (!row) return;

    // Result가 있으면 표시
    const hasValue = row.Result !== "" && row.Result != null;

    map[meta.freq] = {
      measured: hasValue ? Number(row.Result) : null,
      spec:
        targetType === "margin" ? Number(row.Spec_Min) : Number(row.Spec_Max),
      judge: "-", // REF는 판정 없음
      isRef: true,
    };
  });

  return map;
}

const SV_TOOLTIP_MAP = {
  "Min Margin": "Margin = Spec - Rattle Index",
};

function SVKpiSection({ analysis }) {
  const buildKpiCard = (title, rows, isLimit = false) => {
    const validRows = rows.filter((r) => {
      const meta = SV_FREQ_META[r.tcId];
      return meta && !meta.isRef;
    });

    const ngRows = validRows.filter((r) => r.judge === "NG");

    const totalCount = validRows.length;
    const ngCount = ngRows.length;

    const judge = ngCount > 0 ? "NG" : "OK";
    const isNg = judge === "NG";

    // range 추출
    const ngRanges = ngRows
      .map((r) => SV_FREQ_META[r.tcId]?.freq)
      .filter(Boolean);

    const specValue = rows.find((r) => r.spec != null)?.spec ?? "-";
    const tooltip = SV_TOOLTIP_MAP[title];

    return (
      <Box
        sx={{
          flex: 1,
          border: "1px solid #e5e7eb",
          borderRadius: 2,
          px: 1.5,
          py: 1.5,
          backgroundColor: isNg ? "#FFF5F5" : "#fafbfc",
          display: "flex",
          flexDirection: "column",
          gap: 1,

          // 높이 안정화
          minHeight: 150,
          height: 150,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {tooltip ? (
            <Tooltip title={tooltip} placement="top">
              <Typography
                fontWeight={700}
                sx={{
                  cursor: "help",
                  borderBottom: "1px dotted #aaa",
                }}
              >
                {title}
              </Typography>
            </Tooltip>
          ) : (
            <Typography fontWeight={700}>{title}</Typography>
          )}

          <JudgePill value={judge} />
        </Box>
        {/* Count */}
        <Typography sx={{ fontSize: 20, fontWeight: 700 }}>
          NG Frequency Bands:{" "}
          <Box
            component="span"
            sx={{
              color: isNg ? "#E5533D" : "#4A90E2",
            }}
          >
            {ngCount} / {totalCount}
          </Box>
        </Typography>
        {/* Range */}
        {/* <Box sx={{ fontSize: 12, pl: 1 }}> */}
        <Box
          sx={{
            fontSize: 12,
            pl: 1,

            // NG range가 많아질 때 카드 전체가 늘어나지 않게
            maxHeight: 52,
            overflowY: "auto",
          }}
        >
          {ngRanges.length > 0 ? (
            ngRanges.map((r) => (
              <Box key={r} sx={{ display: "flex", gap: 0.5 }}>
                <span>•</span>
                <span>{r} Hz</span>
              </Box>
            ))
          ) : (
            <Typography sx={{ fontSize: 12 }}>All Pass</Typography>
          )}
        </Box>
        {/* Spec */}
        <Typography
          variant="caption"
          sx={{
            color: "#666",
            mt: "auto",
            pt: 0.75,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          {isLimit
            ? `Rattle Index Spec ≤ ${specValue}`
            : `Margin Spec ≥ ${specValue}`}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      {buildKpiCard("Min Margin", analysis.marginResults)}
      {buildKpiCard("Max Rattle Index", analysis.limitResults, true)}
    </Box>
  );
}

function SVChartLoading() {
  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        color: "#777",
      }}
    >
      <HourglassBottomIcon
        sx={{
          fontSize: 24,
          color: "#1976D2",
          animation: "hourglassSpin 1.2s linear infinite",
          "@keyframes hourglassSpin": {
            "0%": {
              transform: "rotate(0deg)",
            },
            "100%": {
              transform: "rotate(360deg)",
            },
          },
        }}
      />

      <Typography variant="body2" sx={{ color: "#777" }}>
        Loading chart data...
      </Typography>
    </Box>
  );
}

function SVChartSection({
  chartOptions,
  chartWrapRef,
  hoverPoint,
  onMouseMove,
  onMouseLeave,
  isLoading,
  sx,
}) {
  const spec = hoverPoint ? Number(hoverPoint.spec) : null;
  const measurement = hoverPoint ? Number(hoverPoint.measurement) : null;

  const margin =
    Number.isFinite(spec) && Number.isFinite(measurement)
      ? spec - measurement
      : null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: "#e5e7eb",
        boxShadow: "none",
        ...sx,
      }}
    >
      <Typography fontWeight={700}>Frequency - Rattle Index</Typography>

      <Box
        ref={chartWrapRef}
        sx={{
          height: 300,
          mt: 2,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <SVChartLoading />
        ) : (
          <>
            <AgChartsReact options={chartOptions} />

            {/* AG Charts 기본 hover/tooltip 막고 custom hover만 사용 */}
            <Box
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                backgroundColor: "transparent",
                cursor: "crosshair",
              }}
            />

            {hoverPoint &&
              Number.isFinite(hoverPoint.tooltipLeft) &&
              Number.isFinite(hoverPoint.tooltipTop) && (
                <Box
                  sx={{
                    position: "absolute",
                    left: `${hoverPoint.tooltipLeft}px`,
                    top: `${hoverPoint.tooltipTop}px`,
                    zIndex: 30,
                    pointerEvents: "none",

                    width: 230,
                    px: 1.25,
                    py: 1,

                    borderRadius: 1.5,
                    backgroundColor: "rgba(40, 40, 40, 0.92)",
                    color: "#fff",
                    fontSize: 12,
                    boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <Box sx={{ fontWeight: 700, mb: 0.75 }}>
                    Frequency: {Number(hoverPoint.x).toFixed(2)} Hz
                  </Box>

                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                  >
                    <Box
                      component="span"
                      sx={{ color: "#D9534F", fontSize: 13, lineHeight: 1 }}
                    >
                      ■
                    </Box>
                    <Box component="span">
                      SPEC: {Number(hoverPoint.spec).toFixed(2)}
                    </Box>
                  </Box>

                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                  >
                    <Box
                      component="span"
                      sx={{
                        color: "#404040",
                        fontSize: 13,
                        lineHeight: 1,
                        textShadow: "0 0 1px #fff",
                      }}
                    >
                      ■
                    </Box>
                    <Box component="span">
                      Rattle Index: {Number(hoverPoint.measurement).toFixed(2)}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      mt: 0.75,
                      pt: 0.75,
                      borderTop: "1px solid rgba(255,255,255,0.18)",
                      fontWeight: 700,
                    }}
                  >
                    Margin = {margin != null ? margin.toFixed(2) : "-"}
                  </Box>
                </Box>
              )}
          </>
        )}
      </Box>
    </Paper>
  );
}

function formatSVValue(value) {
  if (value === null || value === undefined || value === "") return "-";

  const num = Number(value);

  if (!Number.isFinite(num)) return value;

  // 정수는 그대로, 소수는 최대 3자리 정도로 표시
  return Number.isInteger(num) ? String(num) : num.toFixed(3);
}

function getSVCellValue({ itemLabel, freq, map }) {
  const item = map[freq] || {};
  const isRef = item.isRef;

  if (isRef) {
    if (itemLabel === "Spec") return "REF";
    if (itemLabel === "Judge") return "-";
    return item.measured != null ? formatSVValue(item.measured) : "-";
  }

  if (itemLabel === "Measured") return formatSVValue(item.measured);
  if (itemLabel === "Spec") return formatSVValue(item.spec);
  if (itemLabel === "Judge") return item.judge ?? "-";

  return "-";
}

function getSVCellStyle({ itemLabel, value, isRef }) {
  const isJudgeRow = itemLabel === "Judge";

  return {
    textAlign: "center",
    fontSize: 12,
    px: 1,
    py: 0.85,
    borderColor: "#d9dde3",

    backgroundColor: isRef
      ? "#C0C0C0"
      : isJudgeRow
      ? "rgb(255,255,204)"
      : "#fff",

    color: isRef
      ? "#555"
      : value === "NG"
      ? "#E5533D"
      : value === "OK"
      ? "#4A90E2"
      : "inherit",

    fontWeight: isJudgeRow ? 700 : 400,
  };
}

function SVMetricRows({ metricLabel, map, freqList }) {
  const itemRows = ["Measured", "Spec", "Judge"];

  return (
    <>
      {itemRows.map((itemLabel, rowIndex) => (
        <TableRow key={`${metricLabel}-${itemLabel}`}>
          {/* 첫 번째 행에서만 Metric cell 출력 + 3행 병합 */}
          {rowIndex === 0 && (
            <TableCell
              rowSpan={3}
              sx={{
                width: 150,
                textAlign: "center",
                verticalAlign: "middle",
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: "#f8fafc",
                borderColor: "#d9dde3",
                color: "#263238",
              }}
            >
              {metricLabel}
            </TableCell>
          )}

          {/* Item column */}
          <TableCell
            sx={{
              width: 78,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              backgroundColor:
                itemLabel === "Judge" ? "rgb(255,255,204)" : "#fafafa",
              borderColor: "#d9dde3",
            }}
          >
            {itemLabel}
          </TableCell>

          {/* Frequency columns */}
          {freqList.map((freq) => {
            const item = map[freq] || {};
            const value = getSVCellValue({ itemLabel, freq, map });

            return (
              <TableCell
                key={`${metricLabel}-${itemLabel}-${freq}`}
                sx={getSVCellStyle({
                  itemLabel,
                  value,
                  isRef: item.isRef,
                })}
              >
                {value}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}

function SVFrequencyTable({
  analysis,
  selectedModel,
  selectedSample,
  bigData,
  sx,
}) {
  const marginMap = buildFullFreqMap(
    analysis.marginResults,
    "margin",
    selectedModel,
    selectedSample,
    bigData
  );

  const limitMap = buildFullFreqMap(
    analysis.limitResults,
    "limit",
    selectedModel,
    selectedSample,
    bigData
  );

  const freqList = [
    ...new Set(Object.values(SV_FREQ_META).map((m) => m.freq)),
  ].sort((a, b) => {
    const aStart = parseInt(a, 10);
    const bStart = parseInt(b, 10);
    return aStart - bStart;
  });

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        mt: 0,
        borderRadius: 1.5,
        overflow: "hidden",
        boxShadow: "none",
        borderColor: "#d9dde3",
        ...sx,
      }}
    >
      <Table
        size="small"
        sx={{
          tableLayout: "fixed",

          "& .MuiTableCell-root": {
            // borderColor: "#d9dde3",
            border: "1px solid #d9dde3",
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell
              colSpan={2}
              sx={{
                width: 118 + 72,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                backgroundColor: "#eef2f7",
                color: "#263238",
                borderRight: "1px solid #d9dde3",
              }}
            >
              Frequency Range (Hz)
            </TableCell>

            {freqList.map((freq) => (
              <TableCell
                key={freq}
                sx={{
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  backgroundColor: "#eef2f7",
                  color: "#263238",
                  borderRight: "1px solid #d9dde3",
                }}
              >
                {freq}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>

        <TableBody>
          <SVMetricRows
            metricLabel="Min. Margin"
            map={marginMap}
            freqList={freqList}
          />

          <SVMetricRows
            metricLabel="Max. Rattle Index"
            map={limitMap}
            freqList={freqList}
          />
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const buildSampleSheetMap = (summaryRows) => {
  const map = {};

  let currentIndex = null;

  summaryRows.forEach((row) => {
    const val = row.__EMPTY;

    // "#1", "#2" 같은 section 표시
    if (typeof val === "string" && val.startsWith("#")) {
      currentIndex = val.replace("#", ""); // "1", "2"
    }

    // sample 번호 (410, 411 ...)
    else if (typeof val === "number" && currentIndex !== null) {
      const sample = val;
      const sheetName = `Raw_data (${currentIndex})`;

      map[sample] = sheetName;
    }
  });

  return map;
};

const loadExcelFromPublic = async (filePath, selectedSample) => {
  const res = await fetch(filePath);
  const buffer = await res.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  if (!res.ok) {
    throw new Error("파일 로드 실패");
  }

  if (DEBUG) console.log("SheetNames:", workbook.SheetNames);

  // 1. summary 읽기
  const summarySheet = workbook.Sheets["SV_Summary"];
  const summaryJson = XLSX.utils.sheet_to_json(summarySheet, {
    defval: null,
  });

  // 2. sample ↔ sheet 매핑
  const sampleSheetMap = buildSampleSheetMap(summaryJson);
  if (DEBUG) console.log("sampleSheetMap:", sampleSheetMap);

  // 3. 선택한 sample → sheet 찾기
  const sheetName = sampleSheetMap[selectedSample];
  if (!sheetName) {
    console.error("❌ 매핑 실패:", selectedSample);
    return [];
  }
  if (DEBUG) console.log("선택된 sheet:", sheetName);

  // 4. 해당 raw 시트 읽기
  const sheet = workbook.Sheets[sheetName];
  const rawJson = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
  });
  if (DEBUG) console.log("RAW DATA:", rawJson);

  // 5. chart 데이터 변환
  const chartData = rawJson
    .filter(
      (row) =>
        row["Right Channel Index"] != null &&
        row.__EMPTY_30 != null &&
        row.__EMPTY_31 != null
    )
    .map((row) => {
      const spec = Number(row.__EMPTY_30);
      const measurement = Number(row.__EMPTY_31);

      return {
        x: Number(row["Right Channel Index"]),
        spec,
        measurement,
        margin: spec - measurement,
      };
    });

  return chartData;
};

// ======================== React 컴포넌트 시작 ======================== //
export default function SoundNoisePage() {
  /*----------- 상태 선언 -----------*/
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedTestCase, setSelectedTestCase] = useState(null);
  const [selectedSample, setSelectedSample] = useState("");
  const [isDetailOpen, setIsDetailOpen] = useState(false); //isDetailOpen: 슬라이드 패널 열림/닫힘 제어
  const [columnFilters, setColumnFilters] = useState({
    // Text filter
    id: "",
    model: "",
    inch: "",
    grade: "",
    tool: "",
    samples: "",
    user: "",
    seq: "",

    // Select filter
    event: "",
    panel_maker: "",
    product_group: "",
    part: "",
    measured_site: "",

    // Data range filter
    measured_time_from: "",
    measured_time_to: "",
  });
  const [testCaseFilter, setTestCaseFilter] = useState("ALL");

  // API 데이터 상태 추가
  const [sampleInfo, setSampleInfo] = useState([]);
  const [bigData, setBigData] = useState([]);
  const [attachments, setAttachments] = useState([]);

  // 로딩 상태
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);

  const [excelData, setExcelData] = useState([]);

  const [svHoverPoint, setSvHoverPoint] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const getLocalFilePath = ({ model, testCase }) => {
    if (!model) return null;

    let basePath = ""; // basePath 결정

    if (model.measured_site.startsWith("TV_KR")) {
      basePath = "/assets/hevpds/DB2DB/TV_KR_RND";
    } else if (model.measured_site.startsWith("TV_RC")) {
      basePath = "/assets/hevpds/DB2DB/TV_RC_RND";
    } else {
      return null;
    }

    // TC_ID 매핑
    const tcId =
      testCase === "Stick-Slip"
        ? "H22-101"
        : testCase === "Sound Vibration"
        ? "H22-105"
        : null;

    if (!tcId) return null;

    // attachment에서 파일 찾기
    const attachment = attachments.find(
      (a) =>
        Number(a.Model_PK) === Number(model.id) &&
        a.TC_ID === tcId &&
        a.Use_Flag === "Y"
    );

    if (!attachment) return null;

    const fileName = attachment.New_Name;

    // 최종 경로 반환
    return `${basePath}/${model.id}/${fileName}`;
  };

  const getDisplaySampleCount = (model) => {
    if (testCaseFilter === "Stick-Slip") return model.sample_count.stick_slip;
    if (testCaseFilter === "Sound Vibration")
      return model.sample_count.sound_vibration;
    return model.sample_count.total;
  };

  const filteredModels = models
    .filter((model) => {
      /* === sample 없는 모델 제거 === */
      if (
        model.sample_count.stick_slip === 0 &&
        model.sample_count.sound_vibration === 0
      ) {
        return false;
      }

      /* === Test Case 버튼 필터 === */
      if (
        testCaseFilter === "Stick-Slip" &&
        model.sample_count.stick_slip === 0
      ) {
        return false;
      }

      if (
        testCaseFilter === "Sound Vibration" &&
        model.sample_count.sound_vibration === 0
      ) {
        return false;
      }

      /* === Text 필터 === */
      const displaySampleCount = getDisplaySampleCount(model);

      if (
        (columnFilters.id && !String(model.id).includes(columnFilters.id)) ||
        (columnFilters.model &&
          !model.model
            .toLowerCase()
            .includes(columnFilters.model.toLowerCase())) ||
        (columnFilters.inch &&
          !String(model.inch).includes(columnFilters.inch)) ||
        (columnFilters.grade &&
          !model.grade
            .toLowerCase()
            .includes(columnFilters.grade.toLowerCase())) ||
        (columnFilters.samples &&
          !String(displaySampleCount).includes(columnFilters.samples)) ||
        (columnFilters.user &&
          !model.user
            .toLowerCase()
            .includes(columnFilters.user.toLowerCase())) ||
        (columnFilters.seq && !String(model.seq).includes(columnFilters.seq))
      ) {
        return false;
      }

      /* === Select 필터 === */
      if (
        (columnFilters.event && model.event !== columnFilters.event) ||
        (columnFilters.panel_maker &&
          model.panel_maker !== columnFilters.panel_maker) ||
        (columnFilters.product_group &&
          model.product_group !== columnFilters.product_group) ||
        (columnFilters.measured_site &&
          model.measured_site !== columnFilters.measured_site)
      ) {
        return false;
      }

      /* === Date Range 필터 === */
      const measuredTime = new Date(model.measured_time).getTime();

      if (
        (columnFilters.measured_time_from &&
          measuredTime <
            new Date(columnFilters.measured_time_from).getTime()) ||
        (columnFilters.measured_time_to &&
          measuredTime > new Date(columnFilters.measured_time_to).getTime())
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => b.id - a.id)
    .map((model) => ({
      ...model,
      display_sample_count: getDisplaySampleCount(model),
    }));

  const visibleRows = useMemo(() => {
    return filteredModels.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );
  }, [filteredModels, page, rowsPerPage]);

  const samplesForDetail = React.useMemo(() => {
    if (!selectedModel || !selectedTestCase) return [];

    return [
      ...new Set(
        sampleInfo
          .filter(
            (s) =>
              s.Model_PK === selectedModel.id &&
              s.Sample_No !== "Summary" &&
              normalizeItem(s.Item) === selectedTestCase
          )
          .map((s) => s.Sample_No)
      ),
    ];
  }, [selectedModel, selectedTestCase, sampleInfo]);

  const getFilterButtonStyle = (value) => ({
    padding: "6px 12px",
    border: "1px solid #a50034",
    backgroundColor: testCaseFilter === value ? "#a50034" : "#fff",
    color: testCaseFilter === value ? "#fff" : "#a50034",
    cursor: "pointer",
    borderRadius: 4,
  });

  const testCaseColorMap = {
    "Stick-Slip": "#6FAF4F",
    "Sound Vibration": "#F8843F",
  };
  const isStickSlipDetail = selectedTestCase === "Stick-Slip";
  const isSoundVibrationDetail = selectedTestCase === "Sound Vibration";

  const sampleAnalysisMap = React.useMemo(() => {
    if (!isStickSlipDetail || !selectedModel || !samplesForDetail.length) {
      return {};
    }

    const map = {};
    for (const sampleNo of samplesForDetail) {
      map[sampleNo] = analyzeStickSlipSample({
        model: selectedModel,
        sampleNo,
        bigData: bigData,
      });
    }

    return map;
  }, [isStickSlipDetail, selectedModel, samplesForDetail]);

  const summary = React.useMemo(() => {
    const analyses = Object.values(sampleAnalysisMap);

    let ok = 0;
    let ng = 0;

    analyses.forEach((analysis) => {
      if (analysis.sampleOverallJudge === JUDGE_OK) ok++;
      else ng++;
    });

    return { ok, ng };
  }, [sampleAnalysisMap]);

  const svSummary = React.useMemo(() => {
    if (!isSoundVibrationDetail || !selectedModel) return null;

    return buildSoundVibrationSummary({
      model: selectedModel,
      samples: samplesForDetail,
      bigData: bigData,
    });
  }, [isSoundVibrationDetail, selectedModel, samplesForDetail]);

  const svSampleAnalysisMap = React.useMemo(() => {
    if (!isSoundVibrationDetail || !selectedModel || !samplesForDetail.length) {
      return {};
    }

    const map = {};

    samplesForDetail.forEach((sampleNo) => {
      const analysis = buildSoundVibrationAnalysis({
        model: selectedModel,
        sampleNo,
        bigData: bigData,
      });

      map[sampleNo] = analysis;
    });

    return map;
  }, [isSoundVibrationDetail, selectedModel, samplesForDetail]);

  const displaySampleResultMap = React.useMemo(() => {
    if (isSoundVibrationDetail) {
      const resultMap = {};

      Object.entries(svSampleAnalysisMap).forEach(([sampleNo, analysis]) => {
        resultMap[sampleNo] = analysis.overallJudge;
      });

      return resultMap;
    }

    const resultMap = {};

    Object.entries(sampleAnalysisMap).forEach(([sampleNo, analysis]) => {
      resultMap[sampleNo] = analysis.sampleOverallJudge;
    });

    return resultMap;
  }, [isSoundVibrationDetail, svSampleAnalysisMap, sampleAnalysisMap]);

  React.useEffect(() => {
    if (svSummary) {
      if (DEBUG) console.log("SV Summary", svSummary);
    }
  }, [svSummary]);

  const pieData = useMemo(() => {
    if (isSoundVibrationDetail && svSummary) {
      return [
        {
          label: "OK",
          value: svSummary.ok,
          color: "#4A90E2",
        },
        {
          label: "NG",
          value: svSummary.ng,
          color: "#E5533D",
        },
      ];
    }

    // default (Stick-Slip)
    return [
      {
        label: "OK",
        value: summary.ok,
        color: "#4A90E2",
      },
      {
        label: "NG",
        value: summary.ng,
        color: "#E5533D",
      },
    ];
  }, [isSoundVibrationDetail, svSummary, summary]);

  const pieOptions = {
    data: pieData,
    series: [
      {
        type: "pie",
        angleKey: "value",
        legendItemKey: "label",
        fills: pieData.map((d) => d.color),
        strokes: ["#fff"],
        strokeWidth: 1,
        innerRadiusRatio: 0.5,
        tooltip: {
          renderer: ({ datum }) => {
            return {
              title: datum.label,
              content: `${datum.value} sample(s)`,
            };
          },
        },
      },
    ],
    legend: {
      enabled: false, //legend 삭제
    },
  };

  React.useEffect(() => {
    if (selectedSample && !samplesForDetail.includes(selectedSample)) {
      setSelectedSample("");
    }
  }, [samplesForDetail, selectedSample]);

  const okSamples = Object.entries(displaySampleResultMap)
    .filter(([, result]) => result === JUDGE_OK)
    .map(([sample]) => sample);

  const ngSamples = Object.entries(displaySampleResultMap)
    .filter(([, result]) => result === JUDGE_NG)
    .map(([sample]) => sample);

  const selectedSampleAnalysis = React.useMemo(() => {
    if (!isStickSlipDetail || !selectedModel || !selectedSample) return null;

    return analyzeStickSlipSample({
      model: selectedModel,
      sampleNo: selectedSample,
      bigData: bigData,
    });
  }, [isStickSlipDetail, selectedModel, selectedSample]);

  const warmupDuration =
    selectedSampleAnalysis?.warmUp.duration ??
    getStickSlipDurationByMode(selectedModel, "WarmUp");

  const cooldownDuration =
    selectedSampleAnalysis?.coolDown.duration ??
    getStickSlipDurationByMode(selectedModel, "CoolDown");

  const circleStyle = {
    width: 40,
    height: 40,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #ccc",
    backgroundColor: "#f0f0f0",
    color: "#555",
    fontWeight: 600,
    fontSize: 14,
    opacity: 0.4,
    transition: "all 0.3 ease",
  };

  const highlightedCircleStyle = {
    backgroundColor: "#a50034",
    color: "#fff",
    border: "1px solid #a50034",
    opacity: 1,
  };

  const ngStyle = {
    color: "#E5533D",
    fontWeight: "bold",
  };

  const getTooltipHtml = (title, splDetails) => {
    let content = `<div style="padding: 8px 10px; background-color: rgba(40,40,40,0.8);
       color: white; border-radius: 5px; border: 1px solid #555; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
       <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 8px; border-bottom: 1px solid #666;
       padding-bottom: 5px;">${title} Noise Events
       </div>`;
    if (splDetails && splDetails.length > 0) {
      splDetails.forEach((row) => {
        content += `<div style="display: flex; justify-content: space-between; 
         font-size: 0.95em; padding-top: 4px;">
         <span style="color: #ddd;">${row.splRange.replace("~", "-")}dB:</span>
         <span style="margin-left: 12px; font-weight: bold;">${
           row.measuredCount
         }</span>
         </div>`;
      });
    }

    content += `</div>`;
    return content;
  };

  const chartMeta = useMemo(() => {
    if (!selectedModel) return null;

    const warmupMins = parseInt(warmupDuration, 10);
    const cooldownMins = parseInt(cooldownDuration, 10);
    const maxTemp = CHART_CONSTANTS.STICK_SLIP_MAX_TEMP;

    const preWarm = CHART_CONSTANTS.STICK_SLIP_PRE_WARM_MINS;
    const warmupStart = preWarm;
    const warmupEnd = warmupStart + warmupMins;
    const saturationMins = CHART_CONSTANTS.STICK_SLIP_SATURATION_TIME;
    const powerOffTime = warmupEnd + saturationMins;
    const endTime = powerOffTime + cooldownMins;
    const tailMins = warmupMins === 60 ? 30 : 20;
    const totalTime = endTime + tailMins;

    return {
      warmupMins,
      cooldownMins,
      maxTemp,
      preWarm,
      warmupStart,
      warmupEnd,
      saturationMins,
      powerOffTime,
      endTime,
      tailMins,
      totalTime,
    };
  }, [selectedModel, warmupDuration, cooldownDuration]);

  const chartWrapRef = React.useRef(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  React.useLayoutEffect(() => {
    const el = chartWrapRef.current;
    if (!el || !selectedSample) return;

    const updateSize = () => {
      setChartSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();

    // 첫 paint 직후 다시 한 번
    const rafId = requestAnimationFrame(updateSize);

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [selectedSample, selectedModel?.id, isDetailOpen]);

  const plotLeft = 57;
  const plotRight = 20;

  const topOffset = 19.56;
  const bottomOffset = 58;

  const plotWidth = Math.max(0, chartSize.width - plotLeft - plotRight);
  const plotHeight = Math.max(0, chartSize.height - topOffset - bottomOffset);

  const getPlotX = (time) => {
    if (!chartMeta || plotWidth <= 0) return plotLeft;
    return plotLeft + (time / chartMeta.totalTime) * plotWidth;
  };

  const getSpanWidth = (startTime, endTime) => {
    if (!chartMeta || plotWidth <= 0) return 0;
    return ((endTime - startTime) / chartMeta.totalTime) * plotWidth;
  };

  const powerLabelTop = Math.max(2, topOffset - 14); // plot area 바로 위
  const phaseSpanTop = topOffset + plotHeight * 0.1; // plot area 안쪽 상단
  const isChartLayoutReady =
    !!chartMeta && chartSize.width > 0 && chartSize.height > 0;

  // 차트 옵션을 생성하는 useMemo
  const chartOptions = useMemo(() => {
    if (!selectedModel || !selectedSampleAnalysis) {
      return { data: [] };
    }

    const warmupMins = parseInt(warmupDuration, 10);
    const cooldownMins = parseInt(cooldownDuration, 10);
    const maxTemp = CHART_CONSTANTS.STICK_SLIP_MAX_TEMP;

    const preWarm = CHART_CONSTANTS.STICK_SLIP_PRE_WARM_MINS;
    const warmupStart = preWarm;
    const warmupEnd = warmupStart + warmupMins;
    const saturationMins = CHART_CONSTANTS.STICK_SLIP_SATURATION_TIME;
    const powerOffTime = warmupEnd + saturationMins;
    const endTime = powerOffTime + cooldownMins;
    const totalTime = endTime + (warmupMins === 60 ? 30 : 20);

    return {
      data: generateAreaData(
        warmupMins,
        cooldownMins,
        warmupMins === 60 ? 30 : 20
      ),
      series: [
        // Warm-up
        {
          type: "area",
          xKey: "time",
          yKey: "warmup",
          fill: "rgba(229, 83, 61, 0.3)",
          stroke: "rgba(229, 83, 61, 0.7)",
          strokeWidth: 1,
          tooltip: {
            renderer: () => ({
              content: getTooltipHtml(
                "Warm-Up",
                selectedSampleAnalysis.warmUp.splDetails
              ),
            }),
          },
          highlightStyle: {
            series: {
              strokeWidth: 10,
            },
          },
        },
        // Saturation
        {
          type: "area",
          xKey: "time",
          yKey: "saturation",
          fill: "rgb(248, 248, 248)",
          stroke: "rgba(128, 128, 128, 0.6)",
          strokeWidth: 1,
          tooltip: { enabled: false },
        },
        // Cool-down
        {
          type: "area",
          xKey: "time",
          yKey: "cooldown",
          fill: "rgba(74, 144, 226, 0.3)",
          stroke: "rgba(74, 144, 226, 0.7)",
          strokeWidth: 1,
          tooltip: {
            renderer: () => ({
              content: getTooltipHtml(
                "Cool-Down",
                selectedSampleAnalysis.coolDown.splDetails
              ),
            }),
          },
          highlightStyle: {
            series: {
              strokeWidth: 10,
            },
          },
        },
        // Idle
        {
          type: "area",
          xKey: "time",
          yKey: "idle",
          fill: "rgb(248, 248, 248)",
          stroke: "rgba(128, 128, 128, 0.6)",
          strokeWidth: 1,
          tooltip: { enabled: false },
        },

        {
          type: "line",
          xKey: "x",
          yKey: "y",
          data: verticalLineData(preWarm, maxTemp + 10),
          stroke: "#555",
          strokeWidth: 1,
          lineDash: [4, 4],
          marker: { enabled: false },
          tooltip: { enabled: false },
        },
        {
          type: "line",
          xKey: "x",
          yKey: "y",
          data: verticalLineData(warmupEnd, maxTemp + 10),
          stroke: "#555",
          strokeWidth: 1,
          lineDash: [4, 4],
          marker: { enabled: false },
          tooltip: { enabled: false },
        },
        {
          type: "line",
          xKey: "x",
          yKey: "y",
          data: verticalLineData(powerOffTime, maxTemp + 10),
          stroke: "#555",
          strokeWidth: 1,
          lineDash: [4, 4],
          marker: { enabled: false },
          tooltip: { enabled: false },
        },
        {
          type: "line",
          xKey: "x",
          yKey: "y",
          data: verticalLineData(endTime, maxTemp + 10),
          stroke: "#555",
          strokeWidth: 1,
          lineDash: [4, 4],
          marker: { enabled: false },
          tooltip: { enabled: false },
        },
      ],

      axes: [
        {
          type: "number",
          position: "bottom",
          max: totalTime,
          nice: false, // auto 보정 제거
          label: { enabled: false },
          title: { enabled: true, text: "Time (min)" },
          gridLine: { enabled: false },
        },
        {
          type: "number",
          position: "left",
          label: { enabled: false },
          min: 0,
          max: maxTemp + 15,
          nice: false,
          title: { text: "TV Temp. (°C)" },
          gridLine: { enabled: false },
        },
      ],
      legend: { enabled: false },
    };
  }, [selectedModel, selectedSampleAnalysis, warmupDuration, cooldownDuration]); // 의존성 배열

  const drawerPaperSx = {
    width: {
      xs: "100%", // 모바일 → full
      sm: "85%", // small tablet
      md: "70%", // 기본
      lg: "55%", // large screen
      xl: "45%", // ultra wide
    },
    maxWidth: "900px",
    minWidth: "360px",

    p: 2.5,
    pb: 6,

    boxSizing: "border-box",
    overflowY: "auto",

    backgroundColor: "#fff",
    borderLeft: "1px solid #ddd",
    boxShadow: "-4px 0 12px rgba(0,0,0,0.10)",
  };

  const sectionDividerSx = {
    borderBottom: "1px solid #e5e7eb",
  };

  const cardSx = {
    mt: 2,
    overflow: "hidden",
    borderRadius: 2,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  };

  const selectedSVAnalysis = React.useMemo(() => {
    if (!isSoundVibrationDetail || !selectedModel || !selectedSample)
      return null;

    return analyzeSoundVibrationSample({
      model: selectedModel,
      sampleNo: selectedSample,
      bigData: bigData,
    });
  }, [isSoundVibrationDetail, selectedModel, selectedSample]);

  const svChartWrapRef = React.useRef(null);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const fetchValidModelPKs = async () => {
    const res = await fetch(
      `${BASE_URL()}/sound/db/vibration-sample-info?limit=5000`
    );
    const data = await res.json();

    const validRows = data.filter(
      (s) =>
        s.Sample_No !== "Summary" &&
        (normalizeItem(s.Item) === "Stick-Slip" ||
          normalizeItem(s.Item) === "Sound Vibration")
    );

    const modelMap = new Map();

    validRows.forEach((s) => {
      if (!modelMap.has(s.Model_PK)) {
        modelMap.set(s.Model_PK, []);
      }
      modelMap.get(s.Model_PK).push(s);
    });

    return modelMap; // Model_PK → sample_list
  };

  const fetchModels = async () => {
    try {
      setLoadingModels(true);

      const modelSampleMap = await fetchValidModelPKs();

      console.log("===== sample map 확인 =====");
      console.log("modelSampleMap size:", modelSampleMap.size);
      console.log(
        "sample map max PK:",
        Math.max(...Array.from(modelSampleMap.keys()).map((pk) => Number(pk)))
      );

      const res = await fetch(`${BASE_URL()}/sound/db/model-info?limit=5000`);

      console.log("model-info request url:", res.url);
      console.log("model-info response status:", res.status);

      const modelData = await res.json();

      console.log("===== model-info API 응답 확인 =====");
      console.log("modelData length:", modelData.length);
      console.log("modelData first 10:", modelData.slice(0, 10));
      console.log(
        "modelData PK first 20:",
        modelData.slice(0, 20).map((m) => m.PK)
      );
      console.log(
        "modelData max PK:",
        Math.max(...modelData.map((m) => Number(m.PK)))
      );
      console.log(
        "modelData min PK:",
        Math.min(...modelData.map((m) => Number(m.PK)))
      );
      const models = modelData.map((model) => {
        const sampleList = modelSampleMap.get(model.PK) || [];

        const sampleCount = calculateSampleCount(model.PK, sampleList);

        return {
          id: model.PK,
          model: model.Model,
          inch: parseInchFromModel(model.Model),
          grade: "",
          event: model.Event,
          tool: "",
          panel_maker: "",
          sample_count: sampleCount,
          product_group: model.Product_Group,
          part: "",
          measured_site: model.Test_Room,
          user: model.Create_ID,
          measured_time: model.Create_Date,
          seq: model.Event_Seq,
        };
      });

      setModels(models);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [columnFilters, testCaseFilter]);

  useEffect(() => {
    if (!selectedModel || !selectedTestCase || !selectedSample) {
      setExcelData([]);
      setSvHoverPoint(null);
      setLoadingChart(false);
      return;
    }

    const filePath = getLocalFilePath({
      model: selectedModel,
      testCase: selectedTestCase,
    });

    if (!filePath) {
      setExcelData([]);
      setSvHoverPoint(null);
      setLoadingChart(false);
      return;
    }

    let cancelled = false;

    setLoadingChart(true);
    setExcelData([]);
    setSvHoverPoint(null);

    loadExcelFromPublic(filePath, selectedSample)
      .then((data) => {
        if (cancelled) return;
        setExcelData(data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setExcelData([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingChart(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedModel, selectedTestCase, selectedSample, attachments]);

  useEffect(() => {
    if (!DEBUG || !selectedModel || !selectedSample) return;

    const result = buildSoundVibrationAnalysis({
      model: selectedModel,
      sampleNo: selectedSample,
      bigData: bigData,
    });

    if (DEBUG) console.log("SV Analysis ▶", result);
    if (DEBUG) console.log("selectedSample:", selectedSample);
  }, [selectedModel, selectedSample]);

  const fetchModelData = async (model) => {
    if (!model) return;

    try {
      setLoadingDetail(true);
      const modelId = model.id;

      const [sampleRes, bigDataRes, attachRes] = await Promise.all([
        axios.get(
          `${BASE_URL()}/sound/db/vibration-sample-info/by-model/${modelId}?limit=200`
        ),
        axios.get(
          `${BASE_URL()}/sound/db/vibration-bigdata/by-model/${modelId}?limit=1000`
        ),
        axios.get(
          `${BASE_URL()}/sound/db/noise-attachment/by-model/${modelId}?limit=100`
        ),
      ]);

      const samples = sampleRes.data || [];
      const bigdata = bigDataRes.data || [];
      const attach = attachRes.data || [];

      // 상태 저장
      setSampleInfo(samples);
      setBigData(bigdata);
      setAttachments(attach);

      // sample count 계산
      const sampleCount = calculateSampleCount(modelId, samples);

      // selectedModel에 반영
      setSelectedModel((prev) => ({
        ...prev,
        sample_count: sampleCount,
      }));
    } catch (e) {
      console.error("API error:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  const SV_CHART_LAYOUT = {
    plotLeft: 64,
    plotRight: 20,
    tooltipWidth: 230,
    tooltipHeight: 125,
    tooltipGap: 32,
  };

  const handleSVChartMouseMove = React.useCallback(
    (e) => {
      if (!excelData.length || !svChartWrapRef.current) return;

      const rect = svChartWrapRef.current.getBoundingClientRect();

      // AG Charts plot 영역 보정값
      const plotLeft = SV_CHART_LAYOUT.plotLeft;
      const plotRight = SV_CHART_LAYOUT.plotRight;

      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const plotStartX = plotLeft;
      const plotEndX = rect.width - plotRight;
      const plotWidth = plotEndX - plotStartX;

      if (plotWidth <= 0) return;

      const numericData = excelData
        .map((d) => ({
          ...d,
          x: Number(d.x),
          spec: Number(d.spec),
          measurement: Number(d.measurement),
        }))
        .filter(
          (d) =>
            Number.isFinite(d.x) &&
            Number.isFinite(d.spec) &&
            Number.isFinite(d.measurement)
        );

      if (!numericData.length) return;

      const xValues = numericData.map((d) => d.x);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);

      if (!Number.isFinite(minX) || !Number.isFinite(maxX) || minX === maxX) {
        return;
      }

      if (mouseX < plotStartX || mouseX > plotEndX) {
        setSvHoverPoint(null);
        return;
      }

      const ratio = (mouseX - plotStartX) / plotWidth;
      const estimatedX = minX + ratio * (maxX - minX);

      const nearest = numericData.reduce((best, cur) => {
        return Math.abs(cur.x - estimatedX) < Math.abs(best.x - estimatedX)
          ? cur
          : best;
      }, numericData[0]);

      // nearest.x 기준으로 실제 수직선 pixel 위치 계산
      const nearestRatio = (nearest.x - minX) / (maxX - minX);
      const lineLeft = plotStartX + nearestRatio * plotWidth;

      // tooltip 크기 대략값
      const tooltipWidth = SV_CHART_LAYOUT.tooltipWidth;
      const tooltipHeight = SV_CHART_LAYOUT.tooltipHeight;
      const gap = SV_CHART_LAYOUT.tooltipGap;

      // tooltip X: 수직선 오른쪽에 표시, 넘치면 왼쪽으로
      let tooltipLeft = lineLeft + gap;

      if (tooltipLeft + tooltipWidth > rect.width) {
        tooltipLeft = lineLeft - tooltipWidth - gap;
      }

      tooltipLeft = Math.max(
        8,
        Math.min(tooltipLeft, rect.width - tooltipWidth - 8)
      );

      // tooltip Y: 마우스 근처에 표시, 차트 영역 안으로 제한
      let tooltipTop = mouseY - tooltipHeight / 2;

      tooltipTop = Math.max(
        8,
        Math.min(tooltipTop, rect.height - tooltipHeight - 8)
      );

      if (DEBUG) {
        console.log("SV hover tooltip debug:", {
          mouseX,
          mouseY,
          estimatedX,
          nearestX: nearest.x,
          lineLeft,
          tooltipLeft,
          tooltipTop,
          rectWidth: rect.width,
          rectHeight: rect.height,
        });
      }

      setSvHoverPoint({
        ...nearest,

        // chart series 수직선 / hover dot용
        x: nearest.x,
        spec: nearest.spec,
        measurement: nearest.measurement,

        // HTML tooltip 위치용
        lineLeft,
        tooltipLeft,
        tooltipTop,
      });
    },
    [excelData]
  );

  const handleSVChartMouseLeave = React.useCallback(() => {
    setSvHoverPoint(null);
  }, []);

  const SVchartOptions = useMemo(() => {
    if (!excelData.length) return { data: [] };

    const numericData = excelData
      .map((d) => ({
        ...d,
        x: Number(d.x),
        spec: Number(d.spec),
        measurement: Number(d.measurement),
      }))
      .filter(
        (d) =>
          Number.isFinite(d.x) &&
          Number.isFinite(d.spec) &&
          Number.isFinite(d.measurement)
      );

    if (!numericData.length) return { data: [] };

    const xValues = numericData.map((d) => d.x);
    const yValues = numericData.flatMap((d) => [d.spec, d.measurement]);

    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);

    const rawMinY = Math.min(...yValues);
    const rawMaxY = Math.max(...yValues);

    const yPadding = (rawMaxY - rawMinY) * 0.08 || 1;
    const yMin = rawMinY - yPadding;
    const yMax = rawMaxY + yPadding;

    const hoverData = svHoverPoint
      ? [
          {
            x: Number(svHoverPoint.x),
            spec: Number(svHoverPoint.spec),
            measurement: Number(svHoverPoint.measurement),
          },
        ]
      : [];

    // 수직선도 AG Charts 좌표계로 그림
    const verticalHoverLineData = svHoverPoint
      ? [
          {
            x: Number(svHoverPoint.x),
            y: yMin,
          },
          {
            x: Number(svHoverPoint.x),
            y: yMax,
          },
        ]
      : [];

    return {
      data: numericData,

      tooltip: {
        mode: "shared",
        position: {
          anchorTo: "pointer",
        },
      },

      series: [
        // =========================
        // SPEC 기본 series
        // =========================
        {
          type: "line",
          xKey: "x",
          yKey: "spec",
          yName: "SPEC",
          title: "SPEC",

          stroke: "#D9534F",
          strokeWidth: 0,

          marker: {
            enabled: true,
            size: 4,
            fill: "#D9534F",
            stroke: "#D9534F",
          },
        },

        // =========================
        // Measurement 기본 series
        // =========================
        {
          type: "line",
          xKey: "x",
          yKey: "measurement",
          yName: "Measurement",
          title: "Measurement",

          stroke: "#404040",
          strokeWidth: 0,

          marker: {
            enabled: true,
            size: 4,
            fill: "#404040",
            stroke: "#404040",
          },
        },

        // =========================
        // SPEC hover highlight dot
        // =========================
        {
          type: "line",
          data: hoverData,
          xKey: "x",
          yKey: "spec",
          title: "SPEC Hover",

          strokeWidth: 0,
          showInLegend: false,

          marker: {
            enabled: true,
            size: 10,
            fill: "#D9534F",
            stroke: "#ffffff",
            strokeWidth: 3,
          },

          tooltip: {
            enabled: false,
          },
        },

        // =========================
        // Measurement hover highlight dot
        // =========================
        {
          type: "line",
          data: hoverData,
          xKey: "x",
          yKey: "measurement",
          title: "Measurement Hover",

          strokeWidth: 0,
          showInLegend: false,

          marker: {
            enabled: true,
            size: 10,
            fill: "#404040",
            stroke: "#ffffff",
            strokeWidth: 3,
          },

          tooltip: {
            enabled: false,
          },
        },

        // =========================
        // 수직선 series
        // =========================
        {
          type: "line",
          data: verticalHoverLineData,
          xKey: "x",
          yKey: "y",
          title: "Hover Line",

          stroke: "#999",
          strokeWidth: 1,
          lineDash: [4, 4],
          showInLegend: false,

          marker: {
            enabled: false,
          },

          tooltip: {
            enabled: false,
          },
        },
      ],

      axes: [
        {
          type: "number",
          position: "bottom",
          min: minX,
          max: 1000,
          nice: false,

          tick: {
            values: [200, 400, 600, 800, 1000],
            size: 0,
            width: 0,
          },

          title: { text: "Frequency (Hz)" },
        },
        {
          type: "number",
          position: "left",
          min: yMin,
          max: yMax,
          nice: false,

          title: { text: "Rattle Index" },
        },
      ],

      legend: {
        enabled: true,
        position: "top",
      },
    };
  }, [excelData, svHoverPoint]);

  // 이 컴포넌트가 "화면에 무엇을 그릴지"를 React에게 알려주는 부분
  // JSX(HTML처럼 생긴 React 문법) 반환
  // React는 이걸 받아서 화면(DOM)에 그림
  return (
    <div style={{ padding: 0, minHeight: "90vh", position: "relative" }}>
      <>
        {/* ===== 제목 영역 ===== */}
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "flex-start",
            mb: 8,
          }}
        >
          <Box
            sx={{
              borderLeft: "4px solid #a50034",
              pl: 2,
              ml: 0,
            }}
          >
            <Typography variant="h5" fontWeight="bold">
              Sound Noise
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Measurement Models
          </Typography>
        </Box>

        {/* ===== 테이블 영역 ===== */}
        <TableContainer
          component={Paper}
          sx={{
            position: "relative",
            mt: 0,
            mb: 0,
            width: "65vw",
            maxHeight: "70vh",
            // borderRadius: 1,
            // boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {loadingModels && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.6)",
                backdropFilter: "blur(2px)",
              }}
            >
              <Box sx={{ display: "flex", gap: 0.5 }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: "#1976D2",
                      animation: "bounce 1.4s infinite ease-in-out",
                      animationDelay: `${i * 0.2}s`,
                      "@keyframes bounce": {
                        "0%, 80%, 100%": { transform: "scale(0)" },
                        "40%": { transform: "scale(1)" },
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          <Table
            stickyHeader
            size="small"
            sx={{
              // 전체 셀 공통 스타일
              "& .MuiTableCell-root": {
                fontSize: 13,
                padding: "6px 8px",
                border: "none",
                boxShadow: `
                inset 0 -0.5px 0 #e5e7eb,
                inset -0.5px 0 0 #e5e7eb
              `,
              },
              // 헤더 셀 스타일
              "& .MuiTableCell-head": {
                fontWeight: 700,
                backgroundColor: "#f7f8fa",
                boxShadow: `
                inset 0 -1px 0 #d1d5db,
                inset -0.5px 0 0 #d1d5db
              `,
              },

              "& .filter-row .MuiTableCell-root": {
                boxShadow: `
                inset 0 -0.5px 0 #e5e7eb,
                inset -0.5px 0 0 #e5e7eb
              `,
              },

              "& .MuiTableHead-root .MuiTableCell-root": {
                textAlign: "center",
              },
            }}
          >
            {/* ===================== 헤더 ===================== */}
            <TableHead>
              {/* ===== 컬럼 제목 행 ===== */}
              <TableRow>
                <TableCell sx={{ width: 40 }}>ID</TableCell>

                <TableCell sx={{ width: 80 }} align="center">
                  Test Case
                </TableCell>

                <TableCell sx={{ width: 200 }}>Model</TableCell>
                <TableCell sx={{ width: 60 }}>Inch</TableCell>
                <TableCell sx={{ width: 60 }}>Grade</TableCell>
                <TableCell sx={{ width: 60 }}>Event</TableCell>
                <TableCell sx={{ width: 60 }}>Tool</TableCell>
                <TableCell sx={{ width: 100 }}>Panel Maker</TableCell>
                <TableCell sx={{ width: 60 }}>Samples</TableCell>
                <TableCell sx={{ width: 120 }}>Product Group</TableCell>
                <TableCell sx={{ width: 50 }}>Part</TableCell>
                <TableCell sx={{ width: 120 }}>Measured Site</TableCell>
                <TableCell sx={{ width: 120 }}>User</TableCell>
                <TableCell sx={{ width: 200 }}>Measured Time</TableCell>
                <TableCell sx={{ width: 40 }}>Seq</TableCell>
              </TableRow>

              {/* ===== 필터 행 ===== */}

              <TableRow
                className="filter-row"
                sx={{
                  "& .MuiTableCell-root": {
                    backgroundColor: "#ffffff",
                    fontWeight: 400,
                    boxShadow: "inset 0 -0.5px 0 #e5e7eb",
                    padding: "2px",
                  },
                }}
              >
                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.id}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        id: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={testCaseFilter}
                    onChange={(e) => setTestCaseFilter(e.target.value)}
                  >
                    <MenuItem value="ALL">All</MenuItem>
                    <MenuItem value="Stick-Slip">Stick-Slip</MenuItem>
                    <MenuItem value="Sound Vibration">Sound Vibration</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.model}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        model: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.inch}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        inch: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.grade}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        grade: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.event}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        event: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="PV">PV</MenuItem>
                    <MenuItem value="DV">DV</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.tool}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        tool: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.panel_maker}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        panel_maker: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="LGD">LGD</MenuItem>
                    <MenuItem value="BOE">BOE</MenuItem>
                    <MenuItem value="HKC">HKC</MenuItem>
                    <MenuItem value="CSOT">CSOT</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.samples}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        samples: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.product_group}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        product_group: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="TV">TV</MenuItem>
                    <MenuItem value="MNT">MNT</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.part}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        part: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="SET">SET</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <Select
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.measured_site}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        measured_site: e.target.value,
                      })
                    }
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="TV_KR_RND">TV_KR_RND</MenuItem>
                    <MenuItem value="TV_KR_DQA1">TV_KR_DQA1</MenuItem>
                    <MenuItem value="TV_KR_DQA2">TV_KR_DQA2</MenuItem>
                    <MenuItem value="TV_RC_RND">TV_RC_RND</MenuItem>
                    <MenuItem value="TV_RC_DQA">TV_RC_DQA</MenuItem>
                  </Select>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.user}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        user: e.target.value,
                      })
                    }
                  />
                </TableCell>

                <TableCell>
                  <Box
                    sx={{
                      display: "flex",
                      gap: 0.5, // 날짜 사이 간격
                      alignItems: "center",
                    }}
                  >
                    <TextField
                      type="date"
                      size="small"
                      sx={{ ...filterInputSx, width: 120 }}
                      value={columnFilters.measured_time_from}
                      onChange={(e) =>
                        setColumnFilters({
                          ...columnFilters,
                          measured_time_from: e.target.value,
                        })
                      }
                    />
                    <TextField
                      type="date"
                      size="small"
                      sx={{ ...filterInputSx, width: 120 }}
                      value={columnFilters.measured_time_to}
                      onChange={(e) =>
                        setColumnFilters({
                          ...columnFilters,
                          measured_time_to: e.target.value,
                        })
                      }
                    />
                  </Box>
                </TableCell>

                <TableCell>
                  <TextField
                    size="small"
                    fullWidth
                    sx={filterInputSx}
                    value={columnFilters.seq}
                    onChange={(e) =>
                      setColumnFilters({
                        ...columnFilters,
                        seq: e.target.value,
                      })
                    }
                  />
                </TableCell>
              </TableRow>
            </TableHead>

            {/* ===================== 바디 ===================== */}

            <TableBody>
              {visibleRows.map((model) => (
                <TableRow
                  key={model.id}
                  hover
                  selected={selectedModel?.id === model.id}
                  onClick={() => {
                    setSelectedModel(model);
                    // fetchModelData(model);
                  }}
                >
                  <TableCell sx={{ textAlign: "center" }}>{model.id}</TableCell>

                  <TableCell>
                    <Box display="flex" gap={0.75} justifyContent="center">
                      <Tooltip
                        title="Stick-Slip Detail"
                        placement="top"
                        slotProps={{
                          popper: {
                            modifiers: [
                              {
                                name: "offset",
                                options: {
                                  offset: [0, -11], // [x축 이동, y축 거리]
                                },
                              },
                            ],
                          },
                        }}
                      >
                        <Button
                          sx={testCaseButtonSx(hasStickSlip(model), "#6FAF4F")}
                          disabled={!hasStickSlip(model)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModel(model);
                            setSelectedTestCase("Stick-Slip");
                            setSelectedSample("");
                            setIsDetailOpen(true);
                            fetchModelData(model);
                          }}
                        >
                          SS
                        </Button>
                      </Tooltip>

                      <Tooltip
                        title="Sound Vibration Detail"
                        placement="top"
                        slotProps={{
                          popper: {
                            modifiers: [
                              {
                                name: "offset",
                                options: {
                                  offset: [0, -11], // [x축 이동, y축 거리]
                                },
                              },
                            ],
                          },
                        }}
                      >
                        <Button
                          sx={testCaseButtonSx(
                            hasSoundVibration(model),
                            "#F8843F"
                          )}
                          disabled={!hasSoundVibration(model)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedModel(model);
                            setSelectedTestCase("Sound Vibration");
                            setSelectedSample("");
                            setIsDetailOpen(true);
                            fetchModelData(model);
                          }}
                        >
                          SV
                        </Button>
                      </Tooltip>
                    </Box>
                  </TableCell>

                  <TableCell>{model.model}</TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.inch}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.grade}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.event}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.tool}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.panel_maker}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.display_sample_count}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.product_group}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.part}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.measured_site}
                  </TableCell>
                  <TableCell>{model.user}</TableCell>
                  <TableCell>{model.measured_time}</TableCell>
                  <TableCell sx={{ textAlign: "center" }}>
                    {model.seq}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filteredModels.length}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={[10, 20, 50]}
        />
        {/* ===================== Detail 슬라이딩 패널 ===================== */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={isDetailOpen}
          slotProps={{
            paper: {
              sx: drawerPaperSx,
            },
          }}
        >
          {selectedModel && selectedTestCase ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <DetailDrawerHeader
                selectedModel={selectedModel}
                selectedTestCase={selectedTestCase}
                testCaseColorMap={testCaseColorMap}
                onClose={() => setIsDetailOpen(false)}
              />

              <Box sx={sectionDividerSx} />

              <DetailSummarySection
                pieOptions={pieOptions}
                samplesForDetail={samplesForDetail}
                summary={summary}
                okSamples={okSamples}
                ngSamples={ngSamples}
                svSummary={svSummary}
                isSoundVibration={isSoundVibrationDetail}
              />

              <Box sx={sectionDividerSx} />

              <DetailSampleSelectorSection
                selectedSample={selectedSample}
                setSelectedSample={setSelectedSample}
                samplesForDetail={samplesForDetail}
                sampleResultMap={displaySampleResultMap}
              />

              {selectedSample ? (
                <>
                  {isStickSlipDetail && selectedSampleAnalysis && (
                    <>
                      <TemperatureProfileSection
                        chartWrapRef={chartWrapRef}
                        selectedModel={selectedModel}
                        selectedSample={selectedSample}
                        chartOptions={chartOptions}
                        isChartLayoutReady={isChartLayoutReady}
                        chartMeta={chartMeta}
                        getPlotX={getPlotX}
                        getSpanWidth={getSpanWidth}
                        powerLabelTop={powerLabelTop}
                        phaseSpanTop={phaseSpanTop}
                        cardSx={cardSx}
                      />

                      <StickSlipAnalysisSection
                        selectedSample={selectedSample}
                        selectedSampleAnalysis={selectedSampleAnalysis}
                        circleStyle={circleStyle}
                        highlightedCircleStyle={highlightedCircleStyle}
                        ngStyle={ngStyle}
                        cardSx={cardSx}
                      />
                    </>
                  )}

                  {isSoundVibrationDetail && selectedSVAnalysis && (
                    <Paper variant="outlined" sx={cardSx}>
                      <Box
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderBottom: "1px solid #e5e7eb",
                          backgroundColor: "#fafbfc",
                        }}
                      >
                        <Typography variant="subtitle1" fontWeight={700}>
                          Sound Vibration Analysis
                        </Typography>
                      </Box>

                      <Box
                        sx={{
                          px: 2,
                          pt: 2,
                          pb: 2,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        <SVKpiSection analysis={selectedSVAnalysis} />

                        <SVChartSection
                          chartOptions={SVchartOptions}
                          chartWrapRef={svChartWrapRef}
                          hoverPoint={svHoverPoint}
                          onMouseMove={handleSVChartMouseMove}
                          onMouseLeave={handleSVChartMouseLeave}
                          isLoading={loadingChart}
                        />

                        <SVFrequencyTable
                          analysis={selectedSVAnalysis}
                          selectedModel={selectedModel}
                          selectedSample={selectedSample}
                          bigData={bigData}
                        />
                      </Box>
                    </Paper>
                  )}
                </>
              ) : (
                <Typography variant="body2" sx={{ color: "#999" }}>
                  Please select a sample to view detail results.
                </Typography>
              )}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: "#999", p: 2 }}>
              No data selected
            </Typography>
          )}
        </Drawer>
      </>
    </div>
  );
}
