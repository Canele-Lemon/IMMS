// src/pages/testdata/AIOPage.js

import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  Button,
  Tooltip,
} from "@mui/material";
import { grey, amber, green, red } from "@mui/material/colors";
import { AgGridReact } from "ag-grid-react";

import PageLayout from "../../layout/PageLayout";
import { BASE_URL } from "../../config/envvar";
import { LG_RED } from "../../constants/colors";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import {
  VPDS_TEST_CASES,
  TEST_CASE_GROUP_COLORS,
} from "../../constants/VPDSTestCase";

import {
  createDefaultMeasurementDateRange,
  isWithinMeasurementDateRange,
  formatDateTime,
  normalizeDateFilterDigits,
} from "../../utils/measurementDate";

import MeasurementDetailDrawer, {
  MEASUREMENT_DRAWER_WIDTH,
} from "../../components/measurement/MeasurementDetailDrawer";

import AioMeasurementViewer from "../../components/measurement/AioMeasurementViewer";

import {
  buildAioJudgement,
  logAioJudgement,
} from "../../features/aio/aioJudgement";

import { loadAioSpecs } from "../../features/aio/aioSpecApi";

import uiStore from "../../store/uiStore";
import useIsAdmin from "../auth/useIsAdmin";

import FilterClearHeader from "../../components/grid/FilterClearHeader";
import DateTextFloatingFilter from "../../components/grid/DateTextFloatingFilter";

import { measurementDateFieldSx } from "../../styles/measurementStyles";

const SHOW_TEST_CASE_DOTS = false;

const AIO_TEST_ITEMS = new Set([
  "Mech_Inspection",
  "Mech_Measure",
  "PL_Safety",
]);

const AIO_TEST_CASES = VPDS_TEST_CASES.filter((tc) =>
  AIO_TEST_ITEMS.has(tc.Test_Item),
);

const AIO_TEST_CASE_GROUPS = Array.from(
  new Set(AIO_TEST_CASES.map((tc) => tc.Test_Group)),
).map((groupKey) => {
  const testCases = AIO_TEST_CASES.filter((tc) => tc.Test_Group === groupKey);

  return {
    key: groupKey,
    label: testCases[0].groupTitle,
    color: TEST_CASE_GROUP_COLORS[groupKey],
    testCases,
  };
});

const AIO_TABLE_GROUP_ORDER = [
  "PL_Safety",
  "Wobble_Damping",
  "Tilt",
  "Warpage",
  "Size_Weight",
  "Notation_Text_Inspection",
];

const tableGroupOrderIndex = new Map(
  AIO_TABLE_GROUP_ORDER.map((key, index) => [key, index]),
);

const AIO_TABLE_GROUPS = [...AIO_TEST_CASE_GROUPS].sort(
  (a, b) =>
    (tableGroupOrderIndex.get(a.key) ?? 999) -
    (tableGroupOrderIndex.get(b.key) ?? 999),
);

async function enrichAioModelsWithGroups(models, signal) {
  const result = [];

  // 모델별 조회를 최대 5개씩 동시에 처리
  for (let offset = 0; offset < models.length; offset += 5) {
    if (signal?.aborted) {
      throw new Error("조회 취소");
    }

    const batch = models.slice(offset, offset + 5);

    const batchRows = await Promise.all(
      batch.map(async (model) => {
        try {
          // 1. 모델의 LV3 목록 조회
          const response = await axios.get(
            `${BASE_URL()}/api/aio-selection/by-model/${model.id}`,
            { signal },
          );

          if (!Array.isArray(response.data)) {
            throw new Error("AIO 선택 목록 응답이 배열이 아닙니다.");
          }

          // 2. use_flag와 관계없이 해당 모델의 모든 LV3 사용
          const selectedTcIds = [
            ...new Set(
              response.data
                .filter((row) => String(row.model_id) === String(model.id))
                .map((row) => String(row.tc_id ?? "").trim())
                .filter(Boolean),
            ),
          ];

          // 3. 측정값과 선택된 LV3의 SPEC 조회
          const [measurementResult, specsByTcId] = await Promise.all([
            axios
              .get(`${BASE_URL()}/api/aio-data-mea/by-model/${model.id}`, {
                signal,
              })
              .then((measurementResponse) => {
                const payload = measurementResponse.data;

                if (Array.isArray(payload) && payload.length > 1) {
                  throw new Error(
                    "측정 레코드가 여러 개입니다. 사용할 레코드 선택 규칙이 필요합니다.",
                  );
                }

                const data = Array.isArray(payload)
                  ? (payload[0] ?? null)
                  : payload;

                if (
                  data != null &&
                  (typeof data !== "object" || Array.isArray(data))
                ) {
                  throw new Error("측정 응답 형식 확인 필요");
                }

                return {
                  data,
                  error: "",
                };
              })
              .catch((error) => {
                // 취소를 일반 조회 실패로 처리하지 않음
                if (signal?.aborted) throw error;

                console.error(`AIO 측정값 조회 실패: ${model.id}`, error);

                return {
                  data: null,
                  error: error.message || "측정값 조회 실패",
                };
              }),

            loadAioSpecs(BASE_URL(), selectedTcIds),
          ]);

          if (signal?.aborted) {
            throw new Error("조회 취소");
          }

          // 4. 모델 행에 판정에 필요한 원본 데이터 추가
          return {
            ...model,
            aioSelectedTcIds: selectedTcIds,
            aioSelectionError: false,
            aioMeasurement: measurementResult.data,
            aioMeasurementError: measurementResult.error,
            aioSpecsByTcId: specsByTcId,
          };
        } catch (error) {
          if (signal?.aborted) throw error;

          console.error(`AIO 모델 데이터 준비 실패: ${model.id}`, error);

          return {
            ...model,
            aioSelectedTcIds: [],
            aioSelectionError: true,
            aioMeasurement: null,
            aioMeasurementError: error.message || "AIO 모델 데이터 준비 실패",
            aioSpecsByTcId: {},
          };
        }
      }),
    );

    result.push(...batchRows);
  }

  return result;
}

function getAioTcJudge(model, tcId) {
  const judge = model?.aioJudgementsByTcId?.[tcId];

  return ["OK", "NG", "N/A"].includes(judge) ? judge : "N/A";
}

function AioGroupTooltip({ group, model }) {
  return (
    <Box sx={{ p: 0.5, minWidth: 220 }}>
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 700,
          mb: 0.75,
          pb: 0.5,
          borderBottom: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        {group.label}
      </Typography>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 0.4,
        }}
      >
        {group.testCases.map((tc) => {
          const judge = getAioTcJudge(model, tc.TC_ID);
          const isNg = judge === "NG";
          const isOk = judge === "OK";
          const isNa = !isNg && !isOk;

          const badge = isNg
            ? {
                color: "#fff",
                bg: "rgba(229,83,61,0.95)",
                border: "1px solid rgba(255,255,255,0.35)",
              }
            : isOk
              ? {
                  color: "#fff",
                  bg: "rgba(56,142,60,0.95)",
                  border: "1px solid rgba(255,255,255,0.35)",
                }
              : {
                  color: "#e0e0e0",
                  bg: "rgba(158,158,158,0.25)",
                  border: "1px solid rgba(224,224,224,0.4)",
                };

          return (
            <Box
              key={tc.TC_ID}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                fontSize: 12,
              }}
            >
              <Box
                component="span"
                sx={{
                  fontWeight: isNg ? 700 : 400,
                  color: isNg ? "#ffb4a8" : isNa ? "#cfcfcf" : "#fff",
                }}
              >
                {tc.subTitle || tc.shortLabel}
              </Box>

              <Box
                component="span"
                sx={{
                  minWidth: 34,
                  px: 0.75,
                  py: 0.15,
                  flexShrink: 0,
                  borderRadius: "999px",
                  textAlign: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: badge.color,
                  backgroundColor: badge.bg,
                  border: badge.border,
                }}
              >
                {judge}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

const aioJudgeBadgeSx = (judge) => ({
  minWidth: 36,
  height: 22,
  px: 0.5,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "999px",
  fontSize: 10,
  fontWeight: 700,
  color: judge === "N/A" ? grey[600] : "#fff",
  backgroundColor:
    judge === "OK" ? green[700] : judge === "NG" ? red[600] : grey[100],
  border: `1px solid ${
    judge === "OK" ? green[700] : judge === "NG" ? red[600] : grey[300]
  }`,
});

function AioTestCaseGroupCell({ data, onGroupClick, showDots = true }) {
  if (!data) return null;

  if (data.aioSelectionError) {
    return (
      <Typography sx={{ py: 1, fontSize: 12, color: amber[900] }}>
        선택 목록 조회 실패
      </Typography>
    );
  }

  const selectedTcIds = new Set(data.aioSelectedTcIds ?? []);

  // 배지 안의 줄바꿈 위치
  const groupLabels = {
    Notation_Text_Inspection: "Notation Text\nInspection",
    Size_Weight: "Size &\nWeight",
    Warpage: "Warpage",
    Tilt: "Tilt",
    Wobble_Damping: "Wobble &\nDamping",
    PL_Safety: "PL & Safety",
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0.75,
        py: 1,
        lineHeight: 1.2,
      }}
    >
      {AIO_TABLE_GROUPS.map((group) => {
        const activeCount = group.testCases.filter((tc) =>
          selectedTcIds.has(tc.TC_ID),
        ).length;

        const groupActive = activeCount > 0;

        return (
          <Box
            key={group.key}
            sx={{
              width: 90,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* 그룹 배지 */}
            <Tooltip
              arrow
              placement="top"
              title={<AioGroupTooltip group={group} model={data} />}
            >
              <Box
                component="span"
                sx={{
                  display: "block",
                  width: "100%",
                }}
              >
                <Button
                  data-measurement-detail-keep-open
                  variant="contained"
                  disableElevation
                  disabled={!groupActive}
                  onClick={(event) => {
                    event.stopPropagation();
                    onGroupClick?.(data, group);
                  }}
                  sx={{
                    width: "100%",
                    minWidth: 0,
                    height: 40,
                    px: 0.5,
                    borderRadius: 1.5,
                    backgroundColor: group.color,
                    border: `1px solid ${group.color}`,
                    color: group.key === "Tilt" ? grey[900] : "#fff",
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: "center",
                    textTransform: "none",
                    whiteSpace: "pre-line",
                    lineHeight: 1.2,

                    "&:hover": {
                      backgroundColor: group.color,
                      filter: "brightness(0.92)",
                    },

                    "&.Mui-disabled": {
                      backgroundColor: grey[100],
                      borderColor: grey[300],
                      color: grey[500],
                    },
                  }}
                >
                  {groupLabels[group.key] ?? group.label}
                </Button>
              </Box>
            </Tooltip>

            {/* 그룹 하위 LV3 상태 표시 */}
            {showDots && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 0.5,
                  minHeight: 24,
                }}
              >
                {group.testCases.map((tc) => {
                  const active = selectedTcIds.has(tc.TC_ID);
                  const badgeWidth = Math.max(
                    48,
                    tc.shortLabel.length * 7 + 16,
                  );

                  return (
                    <Tooltip
                      key={tc.TC_ID}
                      arrow
                      placement="top"
                      title={
                        <Box sx={{ fontSize: 11 }}>
                          <Box component="span" sx={{ fontWeight: 700 }}>
                            {tc.TC_ID} |
                          </Box>{" "}
                          {tc.subTitle || tc.Test_Case}
                        </Box>
                      }
                    >
                      <Box
                        component="span"
                        tabIndex={0}
                        aria-label={`${tc.TC_ID} | ${tc.subTitle || tc.Test_Case}`}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",

                          width: 12,
                          height: 12,
                          flexShrink: 0,
                          boxSizing: "border-box",
                          borderRadius: "999px",
                          overflow: "hidden",

                          backgroundColor: active ? group.color : grey[200],
                          border: `1px solid ${active ? group.color : grey[400]}`,
                          color: active
                            ? group.key === "Tilt"
                              ? grey[900]
                              : "#fff"
                            : grey[700],

                          cursor: "help",
                          transition: "width 180ms ease, height 180ms ease",

                          "& .lv3-short-label": {
                            opacity: 0,
                            whiteSpace: "nowrap",
                            fontSize: 10,
                            fontWeight: 700,
                            lineHeight: 1,
                            transition: "opacity 150ms ease",
                          },

                          "&:hover, &:focus-visible": {
                            width: badgeWidth,
                            height: 22,

                            "& .lv3-short-label": {
                              opacity: 1,
                            },
                          },

                          "&:focus-visible": {
                            outline: `2px solid ${group.color}`,
                            outlineOffset: 2,
                          },
                        }}
                      >
                        <Box component="span" className="lv3-short-label">
                          {tc.shortLabel}
                        </Box>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

const resultField = (field, label, unit = "") => ({
  field,
  label,
  unit,
});

const AIO_RESULT_FIELDS = {
  "H06-103": [
    resultField("mark_antenna", "안테나 표기 기준"),
    resultField("mark_cislot", "CI Slot 표기 기준"),
    resultField("mark_avgender", "Component/AV Gender 단자 표기 기준"),
    resultField("mark_av", "Component/AV 단자 표기 기준"),
    resultField("mark_dc", "DC 단자 표기 기준"),
    resultField("mark_lan", "LAN 표기 기준"),
    resultField("mark_usb", "HDMI/USB 표기 기준"),
    resultField("mark_audio", "OPTICAL AUDIO 표기 기준"),
    resultField("mark_headphone", "HEAD PHONE 표기 기준"),
  ],

  "H07-109": [
    resultField("weight_set", "SET With Stand", "kg"),
    resultField("weight_set_wo_stand", "SET Without Stand", "kg"),
    resultField("weight_stand", "Stand Only", "gram"),
  ],

  "H07-110": [
    resultField("size_width", "가로", "mm"),
    resultField("size_height", "세로", "mm"),
    resultField("size_thickness", "두께", "mm"),
    resultField("size_2pole_width", "2Pole Stand 넓이", "mm"),
  ],

  "H07-116": [
    resultField("size_a_lock", "Kensington Lock Size a", "mm"),
    resultField("size_b_lock", "Kensington Lock Size b", "mm"),
    resultField("mark_lock", "Marker logo 표시 및 양각 적용 여부"),
    resultField("size_lock_key_logo", "Lock Key와 Marker logo 이격 거리", "mm"),
  ],

  "H07-118": [
    resultField("total_warp_top_1", "수평(상측, 1/4)", "mm"),
    resultField("total_warp_top_2", "수평(상측, 2/4)", "mm"),
    resultField("total_warp_top_3", "수평(상측, 3/4)", "mm"),
    resultField("total_warp_left", "수직(좌측)", "mm"),
    resultField("total_warp_right", "수직(우측)", "mm"),
  ],

  "H07-119": [resultField("local_warp_top", "국부적인 휨", "mm")],

  "H07-122": [resultField("tilt_front_back", "전면 SET 기울기(앞/뒤)", "°")],

  "H07-123": [resultField("tilt_left_right", "SET 기울어짐(좌우 편차)", "mm")],

  "H07-124": [
    resultField("damping_auto", "자동측정"),
    resultField("damping_manual", "수동측정", "°"),
  ],

  "H07-125": [
    resultField("wobble_auto", "자동측정", "sec"),
    resultField("wobble_manual", "수동측정", "sec"),
  ],

  "H13-104": [
    resultField("angle_incline_front", "전면 전도각", "°"),
    resultField("angle_incline_back", "후면 전도각", "°"),
  ],

  "H13-105": [
    resultField("angle_falling", "수평 전도 — 기울기 방향", "°"),
    resultField("angle_falling_op", "수평 전도 — 기울기 반대 방향", "°"),
  ],
};

function formatAioResult(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function AioGroupMeasurementResults({
  group,
  selectedTcIds,
  activeTcId,
  resultState,
  onTestCaseSelect,
  judgementsByTcId = {},
}) {
  if (!group) {
    return (
      <Typography sx={{ mt: 2, fontSize: 13, color: "text.secondary" }}>
        왼쪽 메뉴에서 Test Case Group을 선택해주세요.
      </Typography>
    );
  }

  if (resultState.status === "loading") {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (resultState.status === "error") {
    return (
      <Typography sx={{ mt: 2, fontSize: 13 }} color="error">
        {resultState.error}
      </Typography>
    );
  }

  if (!resultState.data) {
    return (
      <Typography sx={{ mt: 2, fontSize: 13, color: "text.secondary" }}>
        등록된 AIO 측정 결과가 없습니다.
      </Typography>
    );
  }

  const selectedIds = new Set(selectedTcIds);

  const testCases = group.testCases.filter((tc) => selectedIds.has(tc.TC_ID));

  return (
    <Box sx={{ mt: 2 }}>
      {/* 선택한 그룹명 */}
      <Typography
        sx={{
          mb: 1.25,
          fontSize: 15,
          fontWeight: 700,
          color: group.color,
        }}
      >
        {group.label}
      </Typography>

      {/* 그룹 하위 LV3 KPI 카드 */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(auto-fit, minmax(200px, 1fr))",
          },
          gap: 1.25,
        }}
      >
        {testCases.map((tc) => {
          const fields = AIO_RESULT_FIELDS[tc.TC_ID] ?? [];
          const focused = activeTcId === tc.TC_ID;
          const judge = judgementsByTcId[tc.TC_ID] ?? "N/A";

          return (
            <Box
              key={tc.TC_ID}
              role="button"
              tabIndex={0}
              aria-pressed={focused}
              aria-label={`${tc.subTitle || tc.shortLabel} 세부 결과`}
              onClick={() => onTestCaseSelect(group.key, tc.TC_ID)}
              onKeyDown={(event) => {
                // 내부 요소의 키 입력은 카드 선택으로 처리하지 않음
                if (event.target !== event.currentTarget) return;

                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onTestCaseSelect(group.key, tc.TC_ID);
                }
              }}
              sx={{
                minWidth: 0,
                minHeight: 190,
                maxHeight: 280,
                boxSizing: "border-box",
                p: 1.25,
                display: "flex",
                flexDirection: "column",
                gap: 1,

                border: `1px solid ${focused ? group.color : "#e5e7eb"}`,
                borderRadius: 2,
                backgroundColor: focused ? "#f1f7f6" : "#fafbfc",
                boxShadow: focused ? `inset 0 0 0 1px ${group.color}` : "none",

                cursor: "pointer",
                transition: "background-color 150ms ease",

                "&:hover": {
                  borderColor: group.color,
                  backgroundColor: "#f1f7f6",
                },

                "&:focus-visible": {
                  outline: `2px solid ${group.color}`,
                  outlineOffset: 2,
                },
              }}
            >
              {/* 카드 제목과 판정 */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 1,
                  flexShrink: 0,
                }}
              >
                <Typography
                  sx={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    color: "#263238",
                  }}
                >
                  {tc.subTitle || tc.shortLabel}
                </Typography>

                <Box component="span" sx={aioJudgeBadgeSx(judge)}>
                  {judge}
                </Box>
              </Box>

              {/* 측정값: 항목이 많으면 카드 내부 스크롤 */}
              <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                {fields.map((item) => {
                  const value = formatAioResult(resultState.data[item.field]);

                  return (
                    <Box
                      key={item.field}
                      sx={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 1,
                        py: 0.75,
                        borderBottom: "1px dashed #e1e7eb",

                        "&:last-child": {
                          borderBottom: "none",
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#263238",
                        }}
                      >
                        {item.label}
                      </Typography>

                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: 0.4,
                          textAlign: "right",
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#263238",
                            fontVariantNumeric: "tabular-nums",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {value}
                        </Typography>

                        {value !== "-" && item.unit && (
                          <Typography
                            sx={{
                              fontSize: 10.5,
                              color: "text.secondary",
                              flexShrink: 0,
                            }}
                          >
                            {item.unit}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}

                {fields.length === 0 && (
                  <Typography sx={{ fontSize: 12 }}>
                    결과 필드가 연결되지 않았습니다.
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function AioTargetInputs({ model, targets, onChange }) {
  const targetRows = [
    ...new Map(
      Object.values(model?.aioJudgement?.testCases ?? {})
        .flatMap((testCase) => testCase.rows)
        .filter((row) => row.needsTarget)
        .map((row) => [row.field, row]),
    ).values(),
  ];

  if (!targetRows.length) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={{ mb: 1, fontSize: 14, fontWeight: 700 }}>
        판정 기준값 입력
      </Typography>

      <Box
        sx={{
          display: "flex",
          gap: 1.5,
          flexWrap: "wrap",
        }}
      >
        {targetRows.map((row) => (
          <TextField
            key={row.field}
            type="number"
            size="small"
            label={`${row.label} 기준값${row.unit ? ` (${row.unit})` : ""}`}
            value={targets[row.field] ?? ""}
            onChange={(event) => onChange(row.field, event.target.value)}
            slotProps={{
              htmlInput: { step: "any" },
            }}
            sx={{ width: 220 }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function AIOPage() {
  const [modelRowData, setModelRowData] = useState([]);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState(null);

  const [selectedGroupDetail, setSelectedGroupDetail] = useState(null);

  const [aioTargetsByModel, setAioTargetsByModel] = useState({});

  const userData = uiStore((state) => state.userData);
  const isAdmin = useIsAdmin();

  const judgedModelRowData = useMemo(
    () =>
      modelRowData.map((model) => {
        const judgement = buildAioJudgement({
          model,
          selectedTcIds: model.aioSelectedTcIds ?? [],
          measurement: model.aioMeasurement,
          measurementError: model.aioMeasurementError ?? "",
          specsByTcId: model.aioSpecsByTcId ?? {},
          targets: aioTargetsByModel[String(model.id)] ?? {},
          fieldDefinitions: AIO_RESULT_FIELDS,
          groups: AIO_TEST_CASE_GROUPS,
        });

        return {
          ...model,
          aioJudgement: judgement,
          aioJudgementsByTcId: Object.fromEntries(
            Object.entries(judgement.testCases).map(([tcId, result]) => [
              tcId,
              result.judge,
            ]),
          ),
          aioJudgementsByGroup: judgement.groups,
          aioOverallJudge: judgement.overall,
        };
      }),
    [modelRowData, aioTargetsByModel],
  );

  const detailModelId = selectedGroupDetail?.model?.id ?? null;

  const selectedModel =
    judgedModelRowData.find(
      (model) => String(model.id) === String(detailModelId),
    ) ?? null;

  const aioResultState = {
    modelId: selectedModel == null ? null : String(selectedModel.id),
    status:
      selectedModel == null
        ? "idle"
        : selectedModel.aioMeasurementError
          ? "error"
          : "success",
    data: selectedModel?.aioMeasurement ?? null,
    error: selectedModel?.aioMeasurementError ?? "",
  };

  const canManageSelectedModel =
    Boolean(selectedModel) &&
    (isAdmin ||
      (userData?.user_id != null &&
        selectedModel.user != null &&
        String(userData.user_id) === String(selectedModel.user)));

  const isDetailOpen = selectedModel !== null;
  const DRAWER_WIDTH = MEASUREMENT_DRAWER_WIDTH;

  const handleOpenGroupDetail = useCallback((model, group = null) => {
    if (!model) return;

    const selectedIds = new Set(model.aioSelectedTcIds ?? []);

    const activeTestCases = (group?.testCases ?? AIO_TEST_CASES).filter((tc) =>
      selectedIds.has(tc.TC_ID),
    );

    // 그룹 버튼은 활성 TC가 있는 경우에만 열기
    if (group && (model.aioSelectionError || activeTestCases.length === 0)) {
      return;
    }

    setSelectedGroupDetail({
      model,
      group,
      activeTestCases,
      selectedTcId: null,
    });
  }, []);

  const handleModelRowClicked = useCallback(
    (event) => {
      if (event.event?.target?.closest?.("button, a, [data-action-buttons]")) {
        return;
      }

      handleOpenGroupDetail(event.data);
    },
    [handleOpenGroupDetail],
  );

  const handleCloseGroupDetail = useCallback(() => {
    setSelectedGroupDetail(null);
  }, []);

  const handleSelectTestCase = useCallback(
    (groupKey, tcId) => {
      const group = AIO_TEST_CASE_GROUPS.find((item) => item.key === groupKey);

      if (!selectedModel || selectedModel.aioSelectionError) {
        return;
      }

      const selectedIds = new Set(selectedModel.aioSelectedTcIds ?? []);

      if (
        !group ||
        !selectedIds.has(tcId) ||
        !group.testCases.some((tc) => tc.TC_ID === tcId)
      ) {
        return;
      }

      setSelectedGroupDetail((prev) => {
        if (!prev || String(prev.model.id) !== String(selectedModel.id)) {
          return prev;
        }

        return {
          ...prev,
          group,
          activeTestCases: group.testCases.filter((tc) =>
            selectedIds.has(tc.TC_ID),
          ),
          selectedTcId: tcId,
        };
      });
    },
    [selectedModel],
  );

  const selectedDetailTc =
    selectedGroupDetail?.group?.testCases.find(
      (tc) =>
        tc.TC_ID === selectedGroupDetail?.selectedTcId &&
        (selectedModel?.aioSelectedTcIds ?? []).includes(tc.TC_ID),
    ) ?? null;

  const [defaultMeasurementDateRange] = useState(() =>
    createDefaultMeasurementDateRange(),
  );

  const [measurementFromDate, setMeasurementFromDate] = useState(
    defaultMeasurementDateRange.from,
  );

  const [measurementToDate, setMeasurementToDate] = useState(
    defaultMeasurementDateRange.to,
  );

  const [appliedMeasurementDateRange, setAppliedMeasurementDateRange] =
    useState(defaultMeasurementDateRange);

  const [modelReloadKey, setModelReloadKey] = useState(0);

  const isMeasurementDateRangeInvalid =
    !measurementFromDate ||
    !measurementToDate ||
    measurementFromDate > measurementToDate;

  const handleMeasurementDateSearch = () => {
    if (isMeasurementDateRangeInvalid) return;

    setAppliedMeasurementDateRange({
      from: measurementFromDate,
      to: measurementToDate,
    });

    setModelReloadKey((prev) => prev + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchModels = async () => {
      setLoadingModel(true);
      setModelError(null);

      try {
        const response = await axios.get(`${BASE_URL()}/api/modelinfo/aio`, {
          signal: controller.signal,
        });

        if (!Array.isArray(response.data)) {
          throw new Error("AIO 모델 목록 응답이 배열이 아닙니다.");
        }

        const visibleModels = response.data.filter((model) =>
          isWithinMeasurementDateRange(
            model,
            appliedMeasurementDateRange.from,
            appliedMeasurementDateRange.to,
          ),
        );

        const enrichedModels = await enrichAioModelsWithGroups(
          visibleModels,
          controller.signal,
        );

        if (!cancelled) {
          setModelRowData(enrichedModels);
        }
      } catch (error) {
        if (cancelled) return;

        console.error("AIO 모델 목록 조회 실패:", error);
        setModelRowData([]);
        setModelError("AIO 모델 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoadingModel(false);
        }
      }
    };

    fetchModels();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    appliedMeasurementDateRange.from,
    appliedMeasurementDateRange.to,
    modelReloadKey,
  ]);

  useEffect(() => {
    judgedModelRowData.forEach((model) => {
      logAioJudgement(model.id, model.aioJudgement);
    });
  }, [judgedModelRowData]);

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      suppressMovable: false,
      minWidth: 90,
      flex: 1,
      headerComponent: FilterClearHeader,
    }),
    [],
  );

  const modelColumnDefs = useMemo(
    () => [
      {
        headerName: "ID",
        field: "id",
        minWidth: 90,
        maxWidth: 110,
        flex: 0.6,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Model",
        field: "model_suffix",
        minWidth: 220,
        flex: 1.6,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Judgement",
        field: "aioOverallJudge",
        minWidth: 110,
        maxWidth: 150,
        flex: 0.8,
        sortable: false,
        filter: false,
        cellStyle: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        },
        valueFormatter: (params) => params.value || "-",
      },
      {
        headerName: "Test Case",
        colId: "test_case_group",
        minWidth: 600,
        flex: 2.2,

        sortable: false,
        filter: false,
        floatingFilter: false,

        autoHeight: true,

        cellStyle: {
          whiteSpace: "normal",
          lineHeight: "normal",
        },

        cellRenderer: AioTestCaseGroupCell,

        cellRendererParams: {
          onGroupClick: handleOpenGroupDetail,
          showDots: SHOW_TEST_CASE_DOTS,
        },
      },
      {
        headerName: "Serial No",
        field: "serial_no",
        minWidth: 150,
        flex: 1.1,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Inch",
        field: "inch",
        minWidth: 90,
        maxWidth: 110,
        flex: 0.6,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Grade",
        field: "grade",
        minWidth: 100,
        flex: 0.7,
      },
      {
        headerName: "Event",
        field: "event",
        minWidth: 100,
        flex: 0.7,
      },
      {
        headerName: "Tool",
        field: "tool",
        minWidth: 100,
        flex: 0.7,
      },
      {
        headerName: "Maker",
        field: "panel_maker",
        minWidth: 100,
        flex: 0.7,
      },
      {
        headerName: "Part",
        field: "part",
        minWidth: 90,
        flex: 0.7,
      },
      {
        headerName: "User",
        field: "user",
        minWidth: 140,
        flex: 1,
        filter: "agTextColumnFilter",
      },
      {
        headerName: "Test Room",
        field: "test_room",
        minWidth: 100,
        flex: 0.9,
      },
      {
        headerName: "Seq",
        field: "sequence",
        minWidth: 90,
        maxWidth: 110,
        flex: 0.6,
        filter: "agNumberColumnFilter",
      },
      {
        headerName: "Measured Time",
        field: "measured_time",
        minWidth: 180,
        flex: 1.2,
        filter: "agTextColumnFilter",
        floatingFilter: true,
        floatingFilterComponent: DateTextFloatingFilter,

        valueFormatter: (params) => formatDateTime(params.value),

        filterValueGetter: (params) =>
          String(params.data?.measured_time ?? "").slice(0, 10),

        filterParams: {
          filterOptions: ["startsWith"],
          defaultOption: "startsWith",
          maxNumConditions: 1,

          textFormatter: normalizeDateFilterDigits,
        },
      },
      {
        headerName: "",
        field: "edit",
        minWidth: 50,
        maxWidth: 50,
        sortable: false,
        filter: false,
        cellRenderer: () => null,
      },
    ],
    [handleOpenGroupDetail],
  );

  return (
    <>
      <PageLayout
        title="기구 All-in-One 측정기 (Mechanical All-in-One Measurement System)"
        contentSx={{
          width: isDetailOpen ? `calc(100% - ${DRAWER_WIDTH} - 8px)` : "100%",
          pr: isDetailOpen ? 1 : 4,
          transition: "width 0.3s ease, padding-right 0.3s ease",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              flexShrink: 0,
              mb: 2,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="h6" fontWeight={300}>
              Measurement Models
            </Typography>

            <Box
              onClick={(event) => {
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  mr: 0.5,
                  color: grey[900],
                  fontSize: 13,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                }}
              >
                Date Range:
              </Typography>
              <TextField
                label="From"
                type="date"
                size="small"
                value={measurementFromDate}
                onChange={(event) => setMeasurementFromDate(event.target.value)}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                  htmlInput: {
                    max: measurementToDate || undefined,
                  },
                }}
                sx={measurementDateFieldSx}
              />

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                ~
              </Typography>

              <TextField
                label="To"
                type="date"
                size="small"
                value={measurementToDate}
                onChange={(event) => setMeasurementToDate(event.target.value)}
                error={isMeasurementDateRangeInvalid}
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                  htmlInput: {
                    min: measurementFromDate || undefined,
                  },
                }}
                sx={measurementDateFieldSx}
              />

              <Button
                variant="contained"
                size="small"
                disabled={isMeasurementDateRangeInvalid}
                onClick={handleMeasurementDateSearch}
                sx={{
                  minWidth: 68,
                  height: 38,
                  px: 2,
                  borderRadius: 1.5,
                  fontSize: 13,
                  fontWeight: 700,
                  boxShadow: "none",
                  backgroundColor: LG_RED[100],

                  "&:hover": {
                    backgroundColor: LG_RED[80],
                    boxShadow: "none",
                  },

                  "&.Mui-disabled": {
                    color: grey[500],
                    backgroundColor: grey[200],
                  },
                }}
              >
                조회
              </Button>
            </Box>
          </Box>

          {modelError && (
            <Typography
              variant="body2"
              sx={{
                flexShrink: 0,
                color: "#E5533D",
                mb: 1,
              }}
            >
              {modelError}
            </Typography>
          )}

          {/* Model List Table */}
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              position: "relative",
            }}
          >
            {loadingModel ? (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <CircularProgress />
              </Box>
            ) : (
              <Box
                className="ag-theme-quartz"
                onClick={(event) => {
                  event.stopPropagation();
                }}
                onMouseDown={(event) => {
                  event.stopPropagation();
                }}
                sx={{
                  height: "100%",
                  width: "100%",

                  "& .ag-cell": {
                    outline: "none !important",
                    border: "none !important",
                  },

                  "& .ag-cell:focus, & .ag-cell:focus-within": {
                    outline: "none !important",
                    border: "none !important",
                  },

                  "& .ag-cell-focus, & .ag-cell-no-focus": {
                    border: "none !important",
                  },

                  "& .ag-row.model-row-active": {
                    backgroundColor: "var(--ag-row-hover-color) !important",
                  },

                  "& .ag-row.model-row-active .ag-cell": {
                    backgroundColor: "transparent !important",
                  },

                  "& .ag-floating-filter-body": {
                    display: "flex",
                    alignItems: "center",
                  },

                  "& .ag-floating-filter-body input": {
                    paddingLeft: "3px !important",
                    paddingRight: "3px !important",
                    textAlign: "left",
                  },

                  "& .ag-floating-filter-body .ag-input-wrapper": {
                    paddingLeft: "0 !important",
                  },
                }}
              >
                <AgGridReact
                  rowData={judgedModelRowData}
                  columnDefs={modelColumnDefs}
                  defaultColDef={defaultColDef}
                  onRowClicked={handleModelRowClicked}
                  getRowId={(params) => String(params.data.id)}
                  maintainColumnOrder
                  // onGridReady={(params) => {
                  //   setGridApi(params.api);
                  // }}
                  pagination
                  paginationPageSize={20}
                />
              </Box>
            )}
          </Box>
        </Box>
      </PageLayout>

      <MeasurementDetailDrawer
        open={isDetailOpen}
        onClose={handleCloseGroupDetail}
        model={selectedModel}
        sectionTitle="Mechanical AIO Measurement"
        sectionColor={LG_RED[100]}
        canManage={canManageSelectedModel}
      >
        {isDetailOpen && (
          <AioMeasurementViewer
            key={selectedModel?.id}
            groups={AIO_TEST_CASE_GROUPS}
            selectedTcIds={selectedModel?.aioSelectedTcIds ?? []}
            activeGroupKey={selectedGroupDetail?.group?.key ?? null}
            onGroupChange={(groupKey) => {
              const group = AIO_TEST_CASE_GROUPS.find(
                (item) => item.key === groupKey,
              );
              handleOpenGroupDetail(selectedModel, group ?? null);
            }}
            activeTcId={selectedGroupDetail?.selectedTcId ?? null}
            onTestCaseSelect={handleSelectTestCase}
          />
        )}
        <AioTargetInputs
          model={selectedModel}
          targets={aioTargetsByModel[String(detailModelId)] ?? {}}
          onChange={(field, value) => {
            if (detailModelId == null) return;

            const modelKey = String(detailModelId);

            setAioTargetsByModel((prev) => ({
              ...prev,
              [modelKey]: {
                ...(prev[modelKey] ?? {}),
                [field]: value,
              },
            }));
          }}
        />
        <AioGroupMeasurementResults
          group={selectedGroupDetail?.group}
          selectedTcIds={selectedModel?.aioSelectedTcIds ?? []}
          activeTcId={selectedGroupDetail?.selectedTcId ?? null}
          onTestCaseSelect={handleSelectTestCase}
          resultState={aioResultState}
          judgementsByTcId={selectedModel?.aioJudgementsByTcId ?? {}}
        />
        {selectedDetailTc && (
          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>
              {selectedDetailTc.subTitle || selectedDetailTc.shortLabel}
              {" · 세부 결과"}
            </Typography>

            {/* 해당 model ID와 selectedDetailTc.TC_ID로
        Raw data를 조회하여 그래프를 넣을 위치 */}
          </Box>
        )}
      </MeasurementDetailDrawer>
    </>
  );
}
