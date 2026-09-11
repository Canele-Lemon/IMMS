// src/pages/analyze/AnalyzePage.js

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import axios from "axios";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Radio,
  RadioGroup,
  Divider,
  Chip,
  Alert,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import RestartAltOutlinedIcon from "@mui/icons-material/RestartAltOutlined";
import AddIcon from "@mui/icons-material/Add";

import { BASE_URL } from "../../config/envvar";
import { debugLog } from "../../utils/logger";
import PageLayout from "../../layout/PageLayout";
import uiStore from "../../store/uiStore";
import {
  VPDS_TEST_CASES,
  TEST_CASE_GROUP_COLORS,
} from "../../constants/VPDSTestCase";
import {
  ANALYZE_CATEGORY,
  ANALYZE_SOURCE,
  ANALYZE_CART_MIN_ITEMS,
} from "../../features/analyze/analyzeConstants";
import {
  createSoundNoiseAnalyzeItemFromCandidate,
  createMechAioAnalyzeItemFromCandidate,
} from "../../features/analyze/analyzeItem";
import { loadAnalyzeCandidates } from "../../features/analyze/analyzeCandidate";
import { LG_RED } from "../../constants/colors";
import { grey } from "@mui/material/colors";

const showAiChat = false;

const DEFAULT_ANALYSIS_TYPE = "기본 분석";

const ANALYSIS_TYPES = [
  DEFAULT_ANALYSIS_TYPE,
  "샘플간 산포 분석",
  "개발 단계 트렌드 분석",
  "모델간 성능 분석",
  "동일 툴 세대 비교 분석",
  "동일 시리즈 다른 인치 분석",
  "측정 산포 분석",
];

const EMPTY_CANDIDATE_FILTERS = {
  modelId: "",
  modelName: "",
  sample: "",
  testCase: "",
  inch: "",
  grade: "",
  event: "",
  tool: "",
  panelMaker: "",
  part: "",
  user: "",
  measuredSite: "",
  sequence: "",
  measuredTime: "",
};

const DEV_MODEL_MAP = {
  "Stick-Slip": {
    "샘플간 산포 분석": [
      {
        modelId: 3583,
        serialNos: ["2607TPP27010", "2607TPP27010"],
      },
    ],

    "개발 단계 트렌드 분석": [
      {
        modelId: 3252,
        serialNos: ["2604TPP06208"],
      },
      {
        modelId: 3324,
        serialNos: ["606KCJZK1284"],
      },
    ],

    "모델간 성능 분석": [
      {
        modelId: 2765,
        serialNos: ["2512TPP15007"],
      },
      {
        modelId: 2826,
        serialNos: ["511KCEAL2204", "511KCKJL2205"],
      },
    ],

    "동일 툴 세대 비교 분석": [
      {
        modelId: 1069,
        serialNos: ["410KCBDKS765", "410KCUKKS758"],
      },
      {
        modelId: 1685,
        serialNos: ["504KCCVLL275", "504KCPYLL272"],
      },
    ],

    "동일 시리즈 다른 인치 분석": [
      {
        modelId: 3622,
        serialNos: ["608KCUKK4990"],
      },
      {
        modelId: 3507,
        serialNos: ["607KCBDKH133"],
      },
      {
        modelId: 3476,
        serialNos: ["607KCASKE696"],
      },
      {
        modelId: 3356,
        serialNos: ["2606TPP01079"],
      },
      {
        modelId: 3286,
        serialNos: ["605KCGWKL599", "605KCMRKL627"],
      },
    ],

    "측정 산포 분석": [
      {
        modelId: 3243,
        serialNos: ["2604TPP06208"],
      },
      {
        modelId: 3252,
        serialNos: ["2604TPP06208"],
      },
    ],
  },

  "Sound Vibration": {
    "샘플간 산포 분석": [
      {
        modelId: 3363,
        serialNos: ["606KCDGK1274", "606KCEAK1276", "606KCGWK1271"],
      },
      {
        modelId: 3475,
        serialNos: ["607KCASKE696", "607KCBDKE701", "607KCJZKE700"],
      },
    ],

    "개발 단계 트렌드 분석": [
      {
        modelId: 3218,
        serialNos: ["2604TPP29005"],
      },
      {
        modelId: 3419,
        serialNos: ["606KCCVKU291"],
      },
      {
        modelId: 3531,
        serialNos: ["502"],
      },
    ],

    "모델간 성능 분석": [
      {
        modelId: 2764,
        serialNos: ["2512TPP15004", "2512TPP15005", "2512TPP15006"],
      },
      {
        modelId: 2825,
        serialNos: ["511KCDGL2202", "511KCEAL2204", "511KCKJL2205"],
      },
    ],

    "동일 툴 세대 비교 분석": [
      {
        modelId: 1068,
        serialNos: ["410KCBDKS765", "410KCKJKS757", "410KCUKKS758"],
      },
      {
        modelId: 1896,
        serialNos: ["508KCCVKW075", "508KCCVKW099", "508KCHEKW073"],
      },
    ],

    "동일 시리즈 다른 인치 분석": [
      {
        modelId: 3620,
        serialNos: ["608KCASK4992", "608KCNLK4991"],
      },
      {
        modelId: 3506,
        serialNos: ["607KCBDKH133"],
      },
      {
        modelId: 3475,
        serialNos: ["607KCASKE696"],
      },
      {
        modelId: 3354,
        serialNos: ["2606TPP01079"],
      },
      {
        modelId: 3284,
        serialNos: ["605KCDGKL626"],
      },
    ],

    "측정 산포 분석": [
      {
        modelId: 1896,
        serialNos: ["508KCCVKW075", "508KCHEKW073"],
      },
      {
        modelId: 1967,
        serialNos: ["508KCCVKW075", "508KCHEKW073"],
      },
    ],
  },

  "Mechanical Measurement": {
    "샘플간 산포 분석": [{ modelId: 59 }, { modelId: 62 }, { modelId: 63 }],

    "개발 단계 트렌드 분석": [{ modelId: 59 }, { modelId: 64 }],

    "모델간 성능 분석": [{ modelId: 59 }, { modelId: 65 }, { modelId: 68 }],

    "동일 툴 세대 비교 분석": [
      { modelId: 70 },
      { modelId: 71 },
      { modelId: 72 },
    ],

    "동일 시리즈 다른 인치 분석": [{ modelId: 59 }, { modelId: 69 }],

    "측정 산포 분석": [{ modelId: 59 }, { modelId: 60 }, { modelId: 61 }],
  },
};

const DEV_ANALYSIS_TYPE_LABELS = {
  "샘플간 산포 분석": "S/No",
  "개발 단계 트렌드 분석": "EVENT",
  "모델간 성능 분석": "MODEL",
  "동일 툴 세대 비교 분석": "Carry-Over",
  "동일 시리즈 다른 인치 분석": "Inch",
  "측정 산포 분석": "MEAS",
};

const getAnalyzeCategoryByTestCase = (testCase) => {
  if (!testCase) {
    return "";
  }

  if (testCase.Test_Item === "Sound_Noise") {
    if (testCase.subTitle === "Stick-Slip") {
      return ANALYZE_CATEGORY.STICK_SLIP;
    }

    if (testCase.subTitle === "Sound Vibration") {
      return ANALYZE_CATEGORY.SOUND_VIBRATION;
    }

    return "";
  }

  if (
    ["Mech_Measure", "Mech_Inspection", "PL_Safety"].includes(
      testCase.Test_Item,
    )
  ) {
    return ANALYZE_CATEGORY.MECH_AIO;
  }

  return "";
};

const getTestCaseMetaByTcId = (tcId) => {
  return VPDS_TEST_CASES.find((testCase) => testCase.TC_ID === tcId);
};

const getTestCaseBadgeColor = (tcId) => {
  const testCase = getTestCaseMetaByTcId(tcId);

  return (
    TEST_CASE_GROUP_COLORS[testCase?.Test_Group] || LG_RED[100] || "#A50034"
  );
};

const getTestItemsByTcIds = (tcIds) => {
  return [
    ...new Set(
      tcIds
        .map((tcId) =>
          VPDS_TEST_CASES.find((testCase) => testCase.TC_ID === tcId),
        )
        .map((testCase) => testCase?.Test_Item)
        .filter(Boolean),
    ),
  ];
};

const getDevModelConfig = (testItemLabel) => {
  switch (testItemLabel) {
    case "Stick-Slip":
      return {
        testItem: "Sound_Noise",
        analyzeCategoryKey: ANALYZE_CATEGORY.STICK_SLIP,
        measurementSource: ANALYZE_SOURCE.SOUND_NOISE,
        tcIds: ["H22-101"],
      };

    case "Sound Vibration":
      return {
        testItem: "Sound_Noise",
        analyzeCategoryKey: ANALYZE_CATEGORY.SOUND_VIBRATION,
        measurementSource: ANALYZE_SOURCE.SOUND_NOISE,
        tcIds: ["H22-105"],
      };

    case "Mechanical Measurement":
      return {
        testItem: "Mech_Measure",
        analyzeCategoryKey: ANALYZE_CATEGORY.MECH_AIO,
        measurementSource: ANALYZE_SOURCE.WARPAGE,
        tcIds: [],
      };

    default:
      return null;
  }
};

const buildKpiCardsFromAnalyzeItems = (analyzeItems) => {
  return analyzeItems.map((item) => ({
    card_key: item.analyzeKey,

    measurement_source: item.measurementSource,

    analyze_category_key: item.analyzeCategoryKey,

    model_id: item.modelId,
    model_suffix: item.modelName || "-",

    sample_serial_no: item.sample || "",

    serial_no: item.sample || "-",

    grade: item.grade || "-",
    tool: item.tool || "-",
    event: item.event || "-",
    user: item.user || "-",

    test_room: item.measuredSite || "-",

    measured_time: item.measuredTime || "-",

    tc_ids: [...(item.tcIds ?? [])],

    raw: item,
  }));
};

const getAnalyzeSelectionContext = ({
  selectedTestItem,
  selectedTestCases,
}) => {
  if (!selectedTestItem || selectedTestCases.length === 0) {
    return null;
  }

  const selectedTestCaseMetas = selectedTestCases
    .map((tcId) => VPDS_TEST_CASES.find((testCase) => testCase.TC_ID === tcId))
    .filter(Boolean);

  if (selectedTestCaseMetas.length !== selectedTestCases.length) {
    return null;
  }

  const analyzeCategoryKeys = [
    ...new Set(
      selectedTestCaseMetas.map(getAnalyzeCategoryByTestCase).filter(Boolean),
    ),
  ];

  if (analyzeCategoryKeys.length !== 1) {
    return null;
  }

  const analyzeCategoryKey = analyzeCategoryKeys[0];

  if (selectedTestItem === "Sound_Noise") {
    if (selectedTestCases.length !== 1) {
      return null;
    }

    return {
      testItem: selectedTestItem,
      tcIds: [...selectedTestCases],

      measurementSource: ANALYZE_SOURCE.SOUND_NOISE,
      analyzeCategoryKey,
    };
  }

  if (selectedTestItem === "Mech_Measure") {
    return {
      testItem: selectedTestItem,
      tcIds: [...selectedTestCases],

      measurementSource: ANALYZE_SOURCE.WARPAGE,
      analyzeCategoryKey: ANALYZE_CATEGORY.MECH_AIO,
    };
  }

  if (
    selectedTestItem === "Mech_Inspection" ||
    selectedTestItem === "PL_Safety"
  ) {
    return {
      testItem: selectedTestItem,
      tcIds: [...selectedTestCases],

      measurementSource: ANALYZE_SOURCE.AIO,
      analyzeCategoryKey: ANALYZE_CATEGORY.MECH_AIO,
    };
  }

  return null;
};

const formatDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDefaultCandidateDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();

  startDate.setMonth(startDate.getMonth() - 3);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate),
  };
};

const includesNormalized = (value, keyword) => {
  const normalizedKeyword = String(keyword).trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return String(value ?? "")
    .toLowerCase()
    .includes(normalizedKeyword);
};

const getCandidateTestCaseSearchText = (candidate) => {
  return (candidate.matchedTestCases ?? [])
    .map((testCase) =>
      [testCase.tcId, testCase.item, testCase.result, testCase.sample]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
};

const normalizeTestCaseResult = (value) => {
  return String(value ?? "")
    .trim()
    .toUpperCase();
};

function formatMeasuredTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const getTestCaseBadgeSx = ({ result, baseColor }) => {
  const normalizedResult = String(result ?? "")
    .trim()
    .toUpperCase();

  const isNg = normalizedResult === "NG";
  const isOk = normalizedResult === "OK";
  const hasResult = normalizedResult !== "";

  return {
    position: "relative",
    overflow: "hidden",

    minWidth: 64,
    height: 26,
    px: 1,

    borderRadius: "999px",

    border: isNg
      ? "2px solid #E5533D"
      : `1px solid ${hasResult ? baseColor : grey[300]}`,

    borderStyle: hasResult ? "solid" : "dashed",

    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",

    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "0.2px",
    whiteSpace: "nowrap",

    color: isOk ? "#fff" : baseColor,
    backgroundColor: isOk ? baseColor : grey[100],

    boxShadow: isNg
      ? "0 0 6px rgba(229, 83, 61, 0.6)"
      : isOk
        ? "0 1px 3px rgba(0, 0, 0, 0.22)"
        : "none",

    "&::after": isNg
      ? {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, " +
            "transparent 47%, " +
            "#E5533D 47%, " +
            "#E5533D 53%, " +
            "transparent 53%)",
          borderRadius: "999px",
          pointerEvents: "none",
        }
      : undefined,
  };
};

const TestCaseBadges = ({ candidate }) => {
  const matchedTestCases = candidate.matchedTestCases ?? [];

  if (matchedTestCases.length === 0) {
    return (
      <Typography component="span" variant="caption" color="text.secondary">
        -
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 0.75,
        minWidth: 180,
      }}
    >
      {matchedTestCases.map((testCase) => {
        const tcId = testCase.tcId;

        const result = normalizeTestCaseResult(testCase.result);

        const baseColor = getTestCaseBadgeColor(tcId);

        const testCaseMeta = getTestCaseMetaByTcId(tcId);

        return (
          <Tooltip
            key={`${candidate.candidateKey}:${tcId}`}
            arrow
            title={
              <Box>
                <Typography variant="caption" sx={{ display: "block" }}>
                  Test Case: {tcId}
                </Typography>

                {testCaseMeta?.subTitle && (
                  <Typography variant="caption" sx={{ display: "block" }}>
                    Name: {testCaseMeta.subTitle}
                  </Typography>
                )}

                <Typography variant="caption" sx={{ display: "block" }}>
                  Result: {result || "-"}
                </Typography>

                {testCase.item && (
                  <Typography variant="caption" sx={{ display: "block" }}>
                    Item: {testCase.item}
                  </Typography>
                )}

                {testCase.sample && (
                  <Typography variant="caption" sx={{ display: "block" }}>
                    Sample: {testCase.sample}
                  </Typography>
                )}
              </Box>
            }
          >
            <Box
              component="span"
              sx={getTestCaseBadgeSx({
                result,
                baseColor,
              })}
            >
              <Box
                component="span"
                sx={{
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {tcId}
              </Box>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
};

export default function AnalyzePage() {
  const [analysisSettingsOpen, setanalysisSettingsOpen] = useState(true);
  const [selectedTestItem, setSelectedTestItem] = useState("");
  const [selectedTestCases, setSelectedTestCases] = useState([]);
  const [alertMessage, setAlertMessage] = useState("");
  const [analysisType, setAnalysisType] = useState(DEFAULT_ANALYSIS_TYPE);

  const [devMode, setDevMode] = useState(false);

  const [selectedAnalyzeItems, setSelectedAnalyzeItems] = useState([]);

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [candidateModels, setCandidateModels] = useState([]);
  const [candidateModelsLoading, setCandidateModelsLoading] = useState(false);
  const [candidateModelsError, setCandidateModelsError] = useState("");
  const [candidateLoadProgress, setCandidateLoadProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [candidateDateRange, setCandidateDateRange] = useState(() =>
    getDefaultCandidateDateRange(),
  );
  const [candidateFilters, setCandidateFilters] = useState(
    EMPTY_CANDIDATE_FILTERS,
  );

  const [selectedCandidateKeys, setSelectedCandidateKeys] = useState([]);
  const [hiddenModelKeys, setHiddenModelKeys] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState("");

  const [comparisonData, setComparisonData] = useState({});
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [analysisExecuted, setAnalysisExecuted] = useState(false);

  const [comparisonRemarksByModel, setComparisonRemarksByModel] = useState({});

  const [draggedModelKey, setDraggedModelKey] = useState(null);
  const [dragOverModelKey, setDragOverModelKey] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);

  const analyzeCart = uiStore((state) => state.analyzeCart);

  const [searchParams] = useSearchParams();

  const analyzeCategoryFromUrl = searchParams.get("analyzeCategory") ?? "";
  const selectedModels = useMemo(() => {
    return buildKpiCardsFromAnalyzeItems(selectedAnalyzeItems);
  }, [selectedAnalyzeItems]);

  const visibleSelectedModels = useMemo(() => {
    return selectedModels.filter(
      (model) => !hiddenModelKeys.includes(model.card_key),
    );
  }, [selectedModels, hiddenModelKeys]);

  const comparisonRows = useMemo(() => {
    return Object.values(comparisonData).sort((a, b) => {
      const parentComparison = String(a.parent_tc_id ?? "").localeCompare(
        String(b.parent_tc_id ?? ""),
        undefined,
        {
          numeric: true,
        },
      );

      if (parentComparison !== 0) {
        return parentComparison;
      }

      return String(a.TC_ID ?? "").localeCompare(
        String(b.TC_ID ?? ""),
        undefined,
        {
          numeric: true,
        },
      );
    });
  }, [comparisonData]);

  const getComparisonRowSpec = (row) => {
    const referenceModel = visibleSelectedModels[0];

    const referenceSpec = referenceModel
      ? row.specByModel?.[referenceModel.card_key]
      : null;

    if (referenceSpec && formatMeasurementSpec(referenceSpec) !== "-") {
      return referenceSpec;
    }

    const firstAvailableSpec = Object.values(row.specByModel ?? {}).find(
      (spec) => formatMeasurementSpec(spec) !== "-",
    );

    return firstAvailableSpec ?? row;
  };

  const autoRunExecutedRef = useRef(false);

  const location = useLocation();

  const openedFromAnalyzeCart = location.state?.openedFromAnalyzeCart === true;

  const autoRunAnalysis = location.state?.autoRunAnalysis === true;

  const analyzeCategoryFromState = location.state?.analyzeCategoryKey ?? "";

  const cartAnalyzeCategoryKey =
    analyzeCategoryFromUrl || analyzeCategoryFromState;

  const analyzeCartItemsForPage = useMemo(() => {
    if (!openedFromAnalyzeCart || !cartAnalyzeCategoryKey) {
      return [];
    }

    return analyzeCart.filter(
      (item) => item.analyzeCategoryKey === cartAnalyzeCategoryKey,
    );
  }, [analyzeCart, cartAnalyzeCategoryKey, openedFromAnalyzeCart]);

  const testItemOptions = useMemo(() => {
    const map = new Map();

    VPDS_TEST_CASES.forEach((item) => {
      if (!map.has(item.Test_Item)) {
        map.set(item.Test_Item, {
          value: item.Test_Item,
          label: item.title,
        });
      }
    });

    return Array.from(map.values());
  }, []);

  const availableTestCases = useMemo(() => {
    return VPDS_TEST_CASES.filter(
      (item) => item.Test_Item === selectedTestItem,
    );
  }, [selectedTestItem]);

  const selectionContext = useMemo(() => {
    return getAnalyzeSelectionContext({
      selectedTestItem,
      selectedTestCases,
    });
  }, [selectedTestItem, selectedTestCases]);

  const handleCandidateFilterChange = (field) => (event) => {
    const value = event.target.value;

    setCandidateFilters((previousFilters) => ({
      ...previousFilters,
      [field]: value,
    }));
  };

  const handleCandidateDateChange = (field) => (event) => {
    const value = event.target.value;

    setCandidateDateRange((previousDateRange) => ({
      ...previousDateRange,
      [field]: value,
    }));
  };

  const handleSearchCandidateModels = async () => {
    await loadCandidateModels({
      dateRange: candidateDateRange,
      context: selectionContext,
    });
  };

  const handleResetCandidateFilters = () => {
    setCandidateFilters({
      ...EMPTY_CANDIDATE_FILTERS,
    });
  };

  const filteredCandidateModels = useMemo(() => {
    return candidateModels.filter((candidate) => {
      return (
        includesNormalized(candidate.modelId, candidateFilters.modelId) &&
        includesNormalized(candidate.modelName, candidateFilters.modelName) &&
        includesNormalized(candidate.sample, candidateFilters.sample) &&
        includesNormalized(
          getCandidateTestCaseSearchText(candidate),
          candidateFilters.testCase,
        ) &&
        includesNormalized(candidate.inch, candidateFilters.inch) &&
        includesNormalized(candidate.grade, candidateFilters.grade) &&
        includesNormalized(candidate.event, candidateFilters.event) &&
        includesNormalized(candidate.tool, candidateFilters.tool) &&
        includesNormalized(candidate.panelMaker, candidateFilters.panelMaker) &&
        includesNormalized(candidate.part, candidateFilters.part) &&
        includesNormalized(candidate.user, candidateFilters.user) &&
        includesNormalized(
          candidate.measuredSite,
          candidateFilters.measuredSite,
        ) &&
        includesNormalized(candidate.sequence, candidateFilters.sequence) &&
        includesNormalized(
          formatMeasuredTime(candidate.measuredTime),
          candidateFilters.measuredTime,
        )
      );
    });
  }, [candidateModels, candidateFilters]);

  const isSoundNoise = selectedTestItem === "Sound_Noise";

  const isMechAioCandidateSource =
    selectionContext?.measurementSource === ANALYZE_SOURCE.WARPAGE ||
    selectionContext?.measurementSource === ANALYZE_SOURCE.AIO;

  const candidateTableColumns = useMemo(() => {
    if (isMechAioCandidateSource) {
      return [
        {
          field: "modelId",
          label: "ID",
          placeholder: "ID",
          minWidth: 80,
        },
        {
          field: "modelName",
          label: "Model",
          placeholder: "Model",
          minWidth: 220,
        },
        {
          field: "sample",
          label: "Sample (Serial No)",
          placeholder: "Sample",
          minWidth: 150,
        },
        {
          field: "testCase",
          label: "Test Case",
          placeholder: "TC / Result",
          minWidth: 220,
        },
        {
          field: "inch",
          label: "Inch",
          placeholder: "Inch",
          minWidth: 80,
        },
        {
          field: "grade",
          label: "Grade",
          placeholder: "Grade",
          minWidth: 90,
        },
        {
          field: "event",
          label: "Event",
          placeholder: "Event",
          minWidth: 90,
        },
        {
          field: "tool",
          label: "Tool",
          placeholder: "Tool",
          minWidth: 90,
        },
        {
          field: "panelMaker",
          label: "Maker",
          placeholder: "Maker",
          minWidth: 110,
        },
        {
          field: "part",
          label: "Part",
          placeholder: "Part",
          minWidth: 100,
        },
        {
          field: "user",
          label: "User",
          placeholder: "User",
          minWidth: 100,
        },
        {
          field: "measuredSite",
          label: "Test Room",
          placeholder: "Test Room",
          minWidth: 110,
        },
        {
          field: "sequence",
          label: "Seq",
          placeholder: "Seq",
          minWidth: 70,
        },
        {
          field: "measuredTime",
          label: "Measured Time",
          placeholder: "Date",
          minWidth: 180,
        },
      ];
    }

    return [
      {
        field: "modelId",
        label: "ID",
        placeholder: "ID",
        minWidth: 80,
      },
      {
        field: "modelName",
        label: "Model",
        placeholder: "Model",
        minWidth: 220,
      },
      {
        field: "sample",
        label: "Sample",
        placeholder: "Sample",
        minWidth: 150,
      },
      {
        field: "inch",
        label: "Inch",
        placeholder: "Inch",
        minWidth: 80,
      },
      {
        field: "event",
        label: "Event",
        placeholder: "Event",
        minWidth: 90,
      },
      {
        field: "tool",
        label: "Tool",
        placeholder: "Tool",
        minWidth: 90,
      },
      {
        field: "user",
        label: "User",
        placeholder: "User",
        minWidth: 100,
      },
      {
        field: "measuredSite",
        label: "Test Room",
        placeholder: "Test Room",
        minWidth: 110,
      },
      {
        field: "sequence",
        label: "Seq",
        placeholder: "Seq",
        minWidth: 70,
      },
      {
        field: "measuredTime",
        label: "Measured Time",
        placeholder: "Date",
        minWidth: 180,
      },
    ];
  }, [isMechAioCandidateSource]);

  const handleComparisonRemarkChange = (cardKey) => (event) => {
    const value = event.target.value;

    setComparisonRemarksByModel((previousRemarks) => ({
      ...previousRemarks,
      value,
    }));
  };

  const handleTestItemChange = (event) => {
    const nextTestItem = event.target.value;

    setSelectedTestItem(nextTestItem);
    setSelectedTestCases([]);

    resetCandidatePicker();

    setSelectedAnalyzeItems([]);
    setHiddenModelKeys([]);

    setAnalysisType(DEFAULT_ANALYSIS_TYPE);
    setAlertMessage("");
    setModelError("");

    setComparisonData({});
    setComparisonError("");
    setAnalysisExecuted(false);
    setComparisonRemarksByModel({});

    autoRunExecutedRef.current = false;
  };

  const selectedSoundNoiseCase = selectedTestCases.find((id) => {
    const tc = VPDS_TEST_CASES.find((item) => item.TC_ID === id);

    return tc?.Test_Item === "Sound_Noise";
  });

  const hasComparisonValue = (value) => {
    return value !== null && value !== undefined && String(value).trim() !== "";
  };

  const formatComparisonUnit = (unit) => {
    const normalizedUnit = String(unit ?? "")
      .trim()
      .toLowerCase();

    if (normalizedUnit === "degree") {
      return "°";
    }

    return String(unit ?? "").trim();
  };

  const formatComparisonValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numericValue = Number(value);

    if (!Number.isNaN(numericValue)) {
      return numericValue.toLocaleString("ko-KR", {
        maximumFractionDigits: 3,
      });
    }

    return String(value);
  };

  const formatValueWithUnit = (value, unit) => {
    if (!hasComparisonValue(value)) {
      return "";
    }

    const formattedValue = formatComparisonValue(value);
    const formattedUnit = formatComparisonUnit(unit);

    return `${formattedValue}${formattedUnit}`;
  };

  const formatMinMaxSpec = ({ min, max, unit }) => {
    const hasMin = hasComparisonValue(min);
    const hasMax = hasComparisonValue(max);

    if (hasMin && hasMax) {
      return `${formatValueWithUnit(min, unit)} 이상 ${formatValueWithUnit(
        max,
        unit,
      )} 이하`;
    }

    if (hasMin) {
      return `${formatValueWithUnit(min, unit)} 이상`;
    }

    if (hasMax) {
      return `${formatValueWithUnit(max, unit)} 이하`;
    }

    return "";
  };

  const formatMeasurementSpec = (measurement) => {
    if (!measurement) {
      return "-";
    }

    const unit = measurement.Unit;

    if (hasComparisonValue(measurement.Spec_Text)) {
      const specText = String(measurement.Spec_Text).trim();
      const formattedUnit = formatComparisonUnit(unit);

      return formattedUnit ? `${specText} ${formattedUnit}` : specText;
    }

    const minMaxSpec = formatMinMaxSpec({
      min: measurement.Spec_Min,
      max: measurement.Spec_Max,
      unit,
    });

    if (minMaxSpec) {
      return minMaxSpec;
    }

    const lslUslSpec = formatMinMaxSpec({
      min: measurement.Spec_LSL,
      max: measurement.Spec_USL,
      unit,
    });

    if (lslUslSpec) {
      return lslUslSpec;
    }

    if (hasComparisonValue(measurement.Spec_Typical)) {
      return `Typical ${formatValueWithUnit(measurement.Spec_Typical, unit)}`;
    }

    const toleranceSpec = formatMinMaxSpec({
      min: measurement.Spec_Tol_Min,
      max: measurement.Spec_Tol_Max,
      unit,
    });

    if (toleranceSpec) {
      return `Tolerance ${toleranceSpec}`;
    }

    const deltaSpec = formatMinMaxSpec({
      min: measurement.Spec_Delta_Min,
      max: measurement.Spec_Delta_Max,
      unit,
    });

    if (deltaSpec) {
      return `Delta ${deltaSpec}`;
    }

    const averageSpec = formatMinMaxSpec({
      min: measurement.Spec_Average_Min,
      max: measurement.Spec_Average_Max,
      unit,
    });

    if (averageSpec) {
      return `Average ${averageSpec}`;
    }

    return "-";
  };

  const formatMeasurementResult = ({ result, unit }) => {
    if (!hasComparisonValue(result)) {
      return "-";
    }

    return formatValueWithUnit(result, unit);
  };

  const isNgJudge = (judge) => {
    return (
      String(judge ?? "")
        .trim()
        .toUpperCase() === "NG"
    );
  };

  const normalizeComparisonResponse = (responseData) => {
    debugLog("[Comparison API] Raw response:", responseData);

    if (!responseData) {
      return [];
    }

    if (Array.isArray(responseData)) {
      return responseData;
    }

    if (Array.isArray(responseData.measurements)) {
      return responseData.measurements;
    }

    if (Array.isArray(responseData.data?.measurements)) {
      return responseData.data.measurements;
    }

    if (Array.isArray(responseData.data)) {
      return responseData.data;
    }

    console.warn(
      "[Comparison API] measurements 배열을 찾지 못했습니다.",
      responseData,
    );

    return [];
  };

  const applyAnalyzeCartItems = (cartItems) => {
    setSelectedAnalyzeItems([...cartItems]);
    setHiddenModelKeys([]);

    if (cartItems.length === 0) {
      setSelectedTestItem("");
      setSelectedTestCases([]);
      return;
    }

    const tcIds = [...new Set(cartItems.flatMap((item) => item.tcIds ?? []))];

    setSelectedTestCases(tcIds);

    const testItems = getTestItemsByTcIds(tcIds);

    setSelectedTestItem(testItems.length === 1 ? testItems[0] : "");
  };

  useEffect(() => {
    if (devMode || !openedFromAnalyzeCart) {
      return;
    }

    setModelError("");
    setHiddenModelKeys([]);

    setComparisonData({});
    setComparisonError("");
    setAnalysisExecuted(false);

    autoRunExecutedRef.current = false;

    if (analyzeCartItemsForPage.length === 0) {
      setSelectedAnalyzeItems([]);
      setSelectedTestItem("");
      setSelectedTestCases([]);
      return;
    }

    applyAnalyzeCartItems(analyzeCartItemsForPage);

    if (autoRunAnalysis) {
      setAnalysisType("모델간 성능 분석");
    }
  }, [
    analyzeCartItemsForPage,
    devMode,
    openedFromAnalyzeCart,
    autoRunAnalysis,
  ]);

  const normalizeModelInfo = (raw, modelId, testItemLabel) => {
    const data = raw?.data ?? raw;

    const isSoundModel =
      testItemLabel === "Stick-Slip" || testItemLabel === "Sound Vibration";

    if (isSoundModel) {
      return {
        model_id: data?.PK ?? modelId,

        source_type: "sound",
        test_item_label: testItemLabel,

        grade: data?.Grade || data?.Tool || "-",
        model_suffix: data?.Model || "-",
        event: data?.Event || "-",

        serial_no:
          data?.Request_No || (data?.PK ? `PK-${data.PK}` : `MODEL-${modelId}`),

        user:
          data?.Create_Name ||
          data?.Create_ID ||
          data?.Update_Name ||
          data?.Update_ID ||
          "-",

        test_room: data?.Test_Room || "-",

        measured_time:
          data?.Start_Date && data.Start_Date !== "0000-00-00 00:00:00"
            ? data.Start_Date
            : data?.Create_Date || data?.Update_Date || "-",

        raw: data,
      };
    }

    return {
      model_id: data?.model_id ?? data?.id ?? modelId,

      source_type: "mech",
      test_item_label: testItemLabel,

      grade: data?.grade ?? "-",
      model_suffix: data?.model_suffix ?? "-",
      event: data?.event ?? "-",
      serial_no: data?.serial_no ?? "-",
      user: data?.user ?? "-",
      test_room: data?.test_room ?? "-",
      measured_time: data?.measured_time ?? "-",

      raw: data,
    };
  };

  const getModelInfoApi = (testItemLabel, modelId) => {
    switch (testItemLabel) {
      case "Stick-Slip":
      case "Sound Vibration":
        return `${BASE_URL()}/sound/db/model-info/${modelId}`;

      case "Mechanical Measurement":
      default:
        return `${BASE_URL()}/api/modelinfo/${modelId}`;
    }
  };

  const loadDevModels = async (testItemLabel, nextAnalysisType) => {
    const devConfig = getDevModelConfig(testItemLabel);

    if (!devConfig) {
      setModelError(`지원하지 않는 개발 모델 유형입니다: ${testItemLabel}`);
      return;
    }

    const modelIds = DEV_MODEL_MAP[testItemLabel]?.[nextAnalysisType] ?? [];

    try {
      setModelLoading(true);
      setModelError("");
      setHiddenModelKeys([]);
      setAnalysisType(nextAnalysisType);
      setSelectedTestItem(devConfig.testItem);

      setSelectedTestCases(devConfig.tcIds);

      const responses = await Promise.all(
        modelIds.map(async (modelConfig, configIndex) => {
          const modelId = modelConfig.modelId;
          const apiUrl = getModelInfoApi(testItemLabel, modelId);

          debugLog("model info api:", apiUrl);

          const response = await axios.get(apiUrl);

          const normalized = normalizeModelInfo(
            response.data,
            modelId,
            testItemLabel,
          );

          return {
            ...normalized,

            card_key: `dev:${testItemLabel}:${modelId}:${configIndex}`,

            measurement_source: devConfig.measurementSource,

            analyze_category_key: devConfig.analyzeCategoryKey,

            sample_serial_no: modelConfig.serialNos?.[0] ?? "",

            serial_no:
              modelConfig.serialNos?.join(", ") ?? normalized.serial_no,

            tc_ids: devConfig.tcIds,
          };
        }),
      );

      const analyzeItems = responses.map((model) => ({
        schemaVersion: 1,

        analyzeKey: model.card_key,

        measurementSource: model.measurement_source,

        analyzeCategoryKey: model.analyze_category_key,

        modelId: model.model_id,
        modelName: model.model_suffix,

        sample: model.sample_serial_no || model.serial_no || "",

        tcIds: [...(model.tc_ids ?? [])],

        grade: model.grade ?? "",
        tool: model.tool ?? "",
        event: model.event ?? "",
        user: model.user ?? "",

        measuredSite: model.test_room ?? "",

        measuredTime: model.measured_time ?? null,
      }));

      setSelectedAnalyzeItems(analyzeItems);

      debugLog("Dev Models Loaded", {
        testItemLabel,
        analysisType: nextAnalysisType,
        modelIds,
        models: responses,
      });
    } catch (error) {
      console.error(error);

      setSelectedAnalyzeItems([]);
      setModelError(
        "개발용 모델 정보를 불러오지 못했습니다. modelinfo API 응답을 확인해 주세요.",
      );
    } finally {
      setModelLoading(false);
    }
  };

  const getComparisonApiUrl = ({
    measurementSource,
    modelId,
    sample,
    tcId,
  }) => {
    switch (measurementSource) {
      case ANALYZE_SOURCE.WARPAGE:
        return `${BASE_URL()}/api/modelinfo/${modelId}/vpds-warp-bigdata/${tcId}`;

      case ANALYZE_SOURCE.SOUND_NOISE:
        throw new Error(
          `[Analyze] SoundNoise 비교 API 미연결: modelId=${modelId}, sample=${sample}, tcId=${tcId}`,
        );

      case ANALYZE_SOURCE.AIO:
        throw new Error(
          `[Analyze] AIO 비교 API 미연결: modelId=${modelId}, tcId=${tcId}`,
        );

      default:
        throw new Error(
          `[Analyze] 지원하지 않는 measurementSource: ${measurementSource}`,
        );
    }
  };

  const loadComparisonData = async (models, tcIds) => {
    const requestTargets = models.flatMap((model) =>
      tcIds.map((tcId) => ({
        cardKey: model.card_key,
        modelId: model.model_id,

        measurementSource: model.measurement_source,

        sample: model.sample_serial_no,

        tcId,
      })),
    );

    const responses = await Promise.allSettled(
      requestTargets.map(
        async ({ cardKey, modelId, measurementSource, sample, tcId }) => {
          const apiUrl = getComparisonApiUrl({
            measurementSource,
            modelId,
            sample,
            tcId,
          });

          const response = await axios.get(apiUrl);

          return {
            cardKey,
            modelId,
            tcId,

            measurements: normalizeComparisonResponse(response.data),
          };
        },
      ),
    );

    const matrixMap = new Map();
    const failedRequests = [];

    responses.forEach((response, index) => {
      const target = requestTargets[index];

      if (response.status === "rejected") {
        failedRequests.push({
          cardKey: target.cardKey,
          modelId: target.modelId,
          tcId: target.tcId,
        });

        console.error(
          `Comparison API failed: card=${target.cardKey}, tc=${target.tcId}`,
          response.reason,
        );

        return;
      }

      const { cardKey, modelId, tcId, measurements } = response.value;

      measurements.forEach((measurement) => {
        const lv4TcId = measurement.TC_ID;

        if (!lv4TcId) {
          return;
        }

        const matrixKey = `${tcId}:${lv4TcId}`;

        if (!matrixMap.has(matrixKey)) {
          matrixMap.set(matrixKey, {
            matrixKey,

            TC_ID: lv4TcId,
            parent_tc_id: tcId,

            Test_Name: measurement.Test_Name ?? "-",

            Options: measurement.Options ?? "-",

            Unit: measurement.Unit ?? "",

            Spec_Text: measurement.Spec_Text ?? null,

            Spec_Min: measurement.Spec_Min ?? null,

            Spec_Max: measurement.Spec_Max ?? null,

            Spec_Typical: measurement.Spec_Typical ?? null,

            Spec_Tol_Min: measurement.Spec_Tol_Min ?? null,

            Spec_Tol_Max: measurement.Spec_Tol_Max ?? null,

            Spec_Delta_Min: measurement.Spec_Delta_Min ?? null,

            Spec_Delta_Max: measurement.Spec_Delta_Max ?? null,

            Spec_Average_Min: measurement.Spec_Average_Min ?? null,

            Spec_Average_Max: measurement.Spec_Average_Max ?? null,

            Spec_LSL: measurement.Spec_LSL ?? null,

            Spec_USL: measurement.Spec_USL ?? null,

            specByModel: {},
            resultsByModel: {},
          });
        }

        const matrixRow = matrixMap.get(matrixKey);

        matrixRow.specByModel[cardKey] = {
          Spec_Text: measurement.Spec_Text ?? null,

          Spec_Min: measurement.Spec_Min ?? null,

          Spec_Max: measurement.Spec_Max ?? null,

          Spec_Typical: measurement.Spec_Typical ?? null,

          Spec_Tol_Min: measurement.Spec_Tol_Min ?? null,

          Spec_Tol_Max: measurement.Spec_Tol_Max ?? null,

          Spec_Delta_Min: measurement.Spec_Delta_Min ?? null,

          Spec_Delta_Max: measurement.Spec_Delta_Max ?? null,

          Spec_Average_Min: measurement.Spec_Average_Min ?? null,

          Spec_Average_Max: measurement.Spec_Average_Max ?? null,

          Spec_LSL: measurement.Spec_LSL ?? null,

          Spec_USL: measurement.Spec_USL ?? null,

          Unit: measurement.Unit ?? "",
        };

        matrixRow.resultsByModel[cardKey] = {
          Result: measurement.Result ?? null,

          Judge: measurement.Judge ?? null,

          Judge_Comment: measurement.Judge_Comment ?? "",

          Model_PK: measurement.Model_PK ?? modelId,

          Sample: measurement.Sample ?? "",

          Evidence_match: measurement.Evidence_match ?? null,

          Unit: measurement.Unit ?? matrixRow.Unit,
        };
      });
    });

    return {
      matrixData: Object.fromEntries(matrixMap),

      failedRequests,
    };
  };

  const mergeAnalyzeItems = (previousItems, nextItems) => {
    const itemMap = new Map(
      previousItems.map((item) => [item.analyzeKey, item]),
    );

    nextItems
      .filter((item) => item?.analyzeKey)
      .forEach((item) => {
        itemMap.set(item.analyzeKey, item);
      });

    return Array.from(itemMap.values());
  };

  const addAnalyzeItemsToSelection = (nextItems) => {
    const validItems = nextItems.filter((item) => item?.analyzeKey);

    if (validItems.length === 0) {
      return [];
    }

    const mergedItems = mergeAnalyzeItems(selectedAnalyzeItems, validItems);

    setSelectedAnalyzeItems(mergedItems);

    setComparisonData({});
    setComparisonError("");
    setAnalysisExecuted(false);
    autoRunExecutedRef.current = false;

    return mergedItems;
  };

  const createAnalyzeItemFromCandidate = (candidate) => {
    if (!selectionContext) {
      return null;
    }

    const selectedTestCaseMeta = VPDS_TEST_CASES.find(
      (testCase) => testCase.TC_ID === selectionContext.tcIds[0],
    );

    if (!selectedTestCaseMeta) {
      return null;
    }

    if (selectionContext.measurementSource === ANALYZE_SOURCE.SOUND_NOISE) {
      return createSoundNoiseAnalyzeItemFromCandidate({
        candidate,
        testCaseMeta: selectedTestCaseMeta,
      });
    }

    return createMechAioAnalyzeItemFromCandidate({
      candidate,

      measurementSource: selectionContext.measurementSource,

      testItem: selectionContext.testItem,

      tcIds: selectionContext.tcIds,
    });
  };

  const handleOpenModelPicker = async () => {
    if (!selectionContext) {
      setAlertMessage("현재 Setting으로 모델 조회 조건을 결정할 수 없습니다.");
      return;
    }

    const defaultDateRange = getDefaultCandidateDateRange();

    setCandidateDateRange(defaultDateRange);

    setModelPickerOpen(true);

    setCandidateModels([]);
    setSelectedCandidateKeys([]);
    setCandidateModelsError("");

    setCandidateFilters({
      ...EMPTY_CANDIDATE_FILTERS,
    });

    setCandidateLoadProgress({
      completed: 0,
      total: 0,
    });

    setAlertMessage("");

    await loadCandidateModels({
      dateRange: defaultDateRange,
      context: selectionContext,
    });
  };

  const loadCandidateModels = async ({
    dateRange,
    context = selectionContext,
  }) => {
    if (!context) {
      setCandidateModelsError(
        "현재 Setting으로 모델 조회 조건을 결정할 수 없습니다.",
      );
      return;
    }

    const { startDate, endDate } = dateRange;

    if (!startDate || !endDate) {
      setCandidateModelsError("조회 시작일과 종료일을 모두 입력해 주세요.");
      return;
    }

    if (startDate > endDate) {
      setCandidateModelsError("조회 시작일은 종료일보다 늦을 수 없습니다.");
      return;
    }

    setCandidateModels([]);
    setSelectedCandidateKeys([]);
    setCandidateModelsError("");
    setCandidateModelsLoading(true);

    setCandidateLoadProgress({
      completed: 0,
      total: 0,
    });

    try {
      const candidates = await loadAnalyzeCandidates({
        context,
        startDate,
        endDate,

        onProgress: ({ completed, total }) => {
          setCandidateLoadProgress({
            completed,
            total,
          });
        },
      });

      console.groupCollapsed("[MECH AIO CANDIDATE CHECK]");

      candidates.forEach((candidate) => {
        console.log({
          modelId: candidate.modelId,
          modelName: candidate.modelName,
          sample: candidate.sample,
          matchedTestCases: candidate.matchedTestCases,
        });
      });

      console.groupEnd();

      const currentAnalyzeKeySet = new Set(
        selectedAnalyzeItems.map((item) => item.analyzeKey),
      );

      const initiallySelectedCandidateKeys = candidates
        .filter((candidate) => {
          const analyzeItem = createAnalyzeItemFromCandidate(candidate);

          return (
            analyzeItem && currentAnalyzeKeySet.has(analyzeItem.analyzeKey)
          );
        })
        .map((candidate) => candidate.candidateKey);

      setCandidateModels(candidates);
      setSelectedCandidateKeys(initiallySelectedCandidateKeys);

      if (candidates.length === 0) {
        setCandidateModelsError(
          "선택한 기간과 Test Case에 해당하는 모델 및 Sample이 없습니다.",
        );
      }
    } catch (error) {
      console.error("[Analyze Candidate] Model list failed:", error);

      setCandidateModels([]);

      setCandidateModelsError(
        error?.response?.data?.detail ??
          error?.message ??
          "선택한 기간과 Test Case에 해당하는 모델 목록을 불러오지 못했습니다.",
      );
    } finally {
      setCandidateModelsLoading(false);
    }
  };

  const resetCandidatePicker = () => {
    setModelPickerOpen(false);
    setCandidateModels([]);
    setSelectedCandidateKeys([]);
    setCandidateModelsError("");
    setCandidateModelsLoading(false);
  };

  const handleToggleCandidate = (candidateKey) => {
    setSelectedCandidateKeys((previousKeys) => {
      if (previousKeys.includes(candidateKey)) {
        return previousKeys.filter((key) => key !== candidateKey);
      }

      return [...previousKeys, candidateKey];
    });
  };

  const handleConfirmCandidateModels = async () => {
    const selectedCandidates = candidateModels.filter((candidate) =>
      selectedCandidateKeys.includes(candidate.candidateKey),
    );

    const nextAnalyzeItems = selectedCandidates
      .map(createAnalyzeItemFromCandidate)
      .filter(Boolean);

    console.groupCollapsed(
      `[ANALYZE PAGE MODEL ADD] ${nextAnalyzeItems.length} item(s)`,
    );

    debugLog("[SELECTION CONTEXT]", selectionContext);

    debugLog("[SELECTED CANDIDATES]", selectedCandidates);

    debugLog("[CREATED ANALYZE ITEMS]", nextAnalyzeItems);

    nextAnalyzeItems.forEach((item, index) => {
      debugLog(`[ANALYZE ITEM ${index + 1}]`, item);
    });

    console.groupEnd();

    const mergedAnalyzeItems = addAnalyzeItemsToSelection(nextAnalyzeItems);

    setModelPickerOpen(false);
    setCandidateModels([]);
    setSelectedCandidateKeys([]);
    setCandidateModelsError("");

    if (mergedAnalyzeItems.length === 0) {
      return;
    }

    const nextSelectedModels =
      buildKpiCardsFromAnalyzeItems(mergedAnalyzeItems);

    setAnalysisType(DEFAULT_ANALYSIS_TYPE);

    await executeComparisonAnalysis({
      models: nextSelectedModels,
      tcIds: selectedTestCases,
      nextAnalysisType: DEFAULT_ANALYSIS_TYPE,
    });
  };

  const handleToggleModelHidden = (cardKey) => {
    setHiddenModelKeys((prev) => {
      if (prev.includes(cardKey)) {
        return prev.filter((key) => key !== cardKey);
      }

      return [...prev, cardKey];
    });
  };

  const handleDeleteModel = (cardKey) => {
    const deletedModel = selectedModels.find(
      (model) => model.card_key === cardKey,
    );

    setSelectedAnalyzeItems((previousItems) =>
      previousItems.filter((item) => item.analyzeKey !== cardKey),
    );

    setHiddenModelKeys((prev) => prev.filter((key) => key !== cardKey));

    setComparisonRemarksByModel((previousRemarks) => {
      const nextRemarks = {
        ...previousRemarks,
      };

      delete nextRemarks[cardKey];

      return nextRemarks;
    });

    if (!deletedModel) {
      return;
    }

    setComparisonData((previousData) => {
      const nextData = {};

      Object.entries(previousData).forEach(([matrixKey, row]) => {
        const nextResultsByModel = {
          ...(row.resultsByModel ?? {}),
        };

        const nextSpecByModel = {
          ...(row.specByModel ?? {}),
        };

        delete nextResultsByModel[cardKey];
        delete nextSpecByModel[cardKey];

        nextData[matrixKey] = {
          ...row,
          resultsByModel: nextResultsByModel,
          specByModel: nextSpecByModel,
        };
      });

      return nextData;
    });
  };

  const executeComparisonAnalysis = async ({
    models,
    tcIds,
    nextAnalysisType,
  }) => {
    if (tcIds.length === 0 || models.length === 0) {
      return;
    }

    const analyzeCategoryKeys = [
      ...new Set(
        models.map((model) => model.analyze_category_key).filter(Boolean),
      ),
    ];

    if (analyzeCategoryKeys.length !== 1) {
      setAlertMessage(
        "동일한 Analyze Category의 모델만 함께 분석할 수 있습니다.",
      );
      return;
    }

    const activeAnalyzeCategoryKey = analyzeCategoryKeys[0];
    const referenceModel = models[0];

    const payload = {
      analyzeCategoryKey: activeAnalyzeCategoryKey,

      selectedTestItem,
      testCases: tcIds,
      analysisType: nextAnalysisType,

      referenceModel: referenceModel
        ? {
            card_key: referenceModel.card_key,
            measurement_source: referenceModel.measurement_source,
            analyze_category_key: referenceModel.analyze_category_key,
            model_id: referenceModel.model_id,
            sample: referenceModel.sample_serial_no,
            tc_ids: referenceModel.tc_ids ?? [],
          }
        : null,

      items: models.map((model, index) => ({
        order: index,
        is_reference: index === 0,

        card_key: model.card_key,
        measurement_source: model.measurement_source,
        analyze_category_key: model.analyze_category_key,
        model_id: model.model_id,
        sample: model.sample_serial_no,
        tc_ids: model.tc_ids ?? [],
      })),
    };

    debugLog("Analysis Start", payload);

    try {
      setAlertMessage("");
      setModelError("");
      setComparisonError("");
      setComparisonLoading(true);
      setAnalysisExecuted(false);

      const { matrixData, failedRequests } = await loadComparisonData(
        models,
        tcIds,
      );

      setComparisonData(matrixData);
      setAnalysisExecuted(true);

      if (failedRequests.length > 0) {
        const failedLabels = failedRequests
          .map(({ modelId, tcId }) => `${modelId}/${tcId}`)
          .join(", ");

        setComparisonError(
          `일부 데이터를 불러오지 못했습니다: ${failedLabels}`,
        );
      }

      debugLog("Comparison Matrix Data", matrixData);
    } catch (error) {
      console.error("Comparison analysis failed", error);

      setComparisonData({});
      setAnalysisExecuted(false);
      setComparisonError("Comparison Matrix 데이터를 불러오지 못했습니다.");
    } finally {
      setComparisonLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (selectedTestCases.length === 0) {
      setAlertMessage("분석할 Test Case를 먼저 선택해 주세요.");
      return;
    }

    if (!analysisType) {
      setAlertMessage("Analysis Type을 먼저 선택해 주세요.");
      return;
    }

    if (analysisType === DEFAULT_ANALYSIS_TYPE) {
      setAlertMessage("기본 분석은 모델을 추가할 때 자동으로 실행됩니다.");
      return;
    }

    if (visibleSelectedModels.length === 0) {
      setModelError(
        "분석에 사용할 모델이 없습니다. Selected Models를 확인해 주세요.",
      );
      return;
    }

    await executeComparisonAnalysis({
      models: visibleSelectedModels,
      tcIds: selectedTestCases,
      nextAnalysisType: analysisType,
    });
  };

  useEffect(() => {
    if (!autoRunAnalysis) {
      return;
    }

    if (autoRunExecutedRef.current) {
      return;
    }

    if (
      visibleSelectedModels.length < ANALYZE_CART_MIN_ITEMS ||
      selectedTestCases.length === 0 ||
      !analysisType
    ) {
      return;
    }

    autoRunExecutedRef.current = true;

    handleRunAnalysis();
  }, [autoRunAnalysis, visibleSelectedModels, selectedTestCases, analysisType]);

  const handleResetAnalysisPage = () => {
    setAnalysisType(DEFAULT_ANALYSIS_TYPE);
    setAlertMessage("");
    setModelError("");

    setHiddenModelKeys([]);
    setDraggedModelKey(null);
    setDragOverModelKey(null);

    setComparisonData({});
    setComparisonError("");
    setComparisonLoading(false);
    setAnalysisExecuted(false);
    setComparisonRemarksByModel({});

    setCandidateModels([]);
    setSelectedCandidateKeys([]);
    setCandidateModelsError("");
    setModelPickerOpen(false);

    autoRunExecutedRef.current = false;

    if (devMode) {
      setSelectedAnalyzeItems([]);
      setSelectedTestItem("");
      setSelectedTestCases([]);
      return;
    }

    if (openedFromAnalyzeCart) {
      applyAnalyzeCartItems(analyzeCartItemsForPage);
      return;
    }

    setSelectedAnalyzeItems([]);
    setSelectedTestItem("");
    setSelectedTestCases([]);
  };

  const handleMoveSelectedModel = (sourceKey, targetKey) => {
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
      return;
    }

    setSelectedAnalyzeItems((previousItems) => {
      const sourceIndex = previousItems.findIndex(
        (item) => item.analyzeKey === sourceKey,
      );

      const targetIndex = previousItems.findIndex(
        (item) => item.analyzeKey === targetKey,
      );

      if (sourceIndex < 0 || targetIndex < 0) {
        return previousItems;
      }

      const nextItems = [...previousItems];

      const [movedItem] = nextItems.splice(sourceIndex, 1);

      nextItems.splice(targetIndex, 0, movedItem);

      return nextItems;
    });
  };

  return (
    <PageLayout title="Analyze">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={devMode}
              onChange={(event) => setDevMode(event.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="caption" color="text.secondary">
              DEMO
            </Typography>
          }
          sx={{ m: 0 }}
        />
      </Box>
      <Box sx={{ display: "flex", height: "calc(100vh - 120px)" }}>
        {/* Analysis Settings */}
        <Paper
          elevation={1}
          sx={{
            width: analysisSettingsOpen ? 320 : 56,
            transition: "width 0.3s",
            mr: 2,
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: 56,
              display: "flex",
              alignItems: "center",
              justifyContent: analysisSettingsOpen ? "space-between" : "center",
              px: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            {analysisSettingsOpen && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  Analysis Settings
                </Typography>

                <Button
                  size="small"
                  color="inherit"
                  startIcon={<RestartAltOutlinedIcon />}
                  onClick={handleResetAnalysisPage}
                  sx={{
                    mr: 0.5,
                    minWidth: 0,
                    textTransform: "none",
                    color: "text.secondary",
                    fontSize: 12,
                  }}
                >
                  초기화
                </Button>
              </Box>
            )}

            <IconButton
              size="small"
              onClick={() => setanalysisSettingsOpen(!analysisSettingsOpen)}
            >
              {analysisSettingsOpen ? (
                <ChevronLeftIcon />
              ) : (
                <ChevronRightIcon />
              )}
            </IconButton>
          </Box>

          {analysisSettingsOpen && (
            <Box sx={{ p: 2 }}>
              {/* Test Item */}
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Test Item
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Test Item</InputLabel>

                <Select
                  value={selectedTestItem}
                  label="Test Item"
                  onChange={handleTestItemChange}
                >
                  {testItemOptions.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Test Case */}
              {selectedTestItem && (
                <>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600}>
                      Test Case
                    </Typography>

                    {selectedTestCases.length > 0 && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setSelectedTestCases([]);
                          setAlertMessage("");
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                  </Box>
                  {alertMessage && (
                    <Alert
                      severity="warning"
                      sx={{ mb: 2 }}
                      onClose={() => setAlertMessage("")}
                    >
                      {alertMessage}
                    </Alert>
                  )}

                  {selectedTestCases.length > 0 && (
                    <Box
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        mb: 2,
                      }}
                    >
                      {selectedTestCases.map((tcId) => {
                        const testCase = VPDS_TEST_CASES.find(
                          (item) => item.TC_ID === tcId,
                        );

                        if (!testCase) return null;

                        return (
                          <Chip
                            key={tcId}
                            label={testCase.subTitle}
                            size="small"
                            onDelete={() => {
                              const nextCases = selectedTestCases.filter(
                                (id) => id !== tcId,
                              );

                              setSelectedTestCases(nextCases);

                              setSelectedAnalyzeItems([]);
                              setHiddenModelKeys([]);

                              setAnalysisType(DEFAULT_ANALYSIS_TYPE);
                              setAlertMessage("");
                              setModelError("");

                              setComparisonData({});
                              setComparisonError("");
                              setAnalysisExecuted(false);

                              autoRunExecutedRef.current = false;
                            }}
                            sx={{
                              bgcolor:
                                TEST_CASE_GROUP_COLORS[testCase.Test_Group] ||
                                "grey",

                              color: "#fff",

                              "& .MuiChip-deleteIcon": {
                                color: "#fff",
                              },
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}

                  {isSoundNoise ? (
                    <RadioGroup
                      value={selectedSoundNoiseCase || ""}
                      onChange={(event) => {
                        const selectedId = event.target.value;

                        setSelectedTestCases([selectedId]);

                        setSelectedAnalyzeItems([]);
                        setHiddenModelKeys([]);

                        setAnalysisType(DEFAULT_ANALYSIS_TYPE);
                        setAlertMessage("");
                        setModelError("");

                        setComparisonData({});
                        setComparisonError("");
                        setAnalysisExecuted(false);

                        autoRunExecutedRef.current = false;
                      }}
                    >
                      {availableTestCases.map((tc) => (
                        <FormControlLabel
                          key={tc.TC_ID}
                          value={tc.TC_ID}
                          control={<Radio />}
                          label={tc.subTitle}
                        />
                      ))}
                    </RadioGroup>
                  ) : (
                    <FormGroup>
                      {availableTestCases.map((tc) => (
                        <FormControlLabel
                          key={tc.TC_ID}
                          control={
                            <Checkbox
                              checked={selectedTestCases.includes(tc.TC_ID)}
                              onChange={(event) => {
                                if (event.target.checked) {
                                  setSelectedTestCases((prev) => [
                                    ...new Set([...prev, tc.TC_ID]),
                                  ]);
                                } else {
                                  setSelectedTestCases((prev) =>
                                    prev.filter((id) => id !== tc.TC_ID),
                                  );
                                }

                                setSelectedAnalyzeItems([]);
                                setHiddenModelKeys([]);

                                setAnalysisType(DEFAULT_ANALYSIS_TYPE);
                                setAlertMessage("");
                                setModelError("");

                                setComparisonData({});
                                setComparisonError("");
                                setAnalysisExecuted(false);

                                autoRunExecutedRef.current = false;
                              }}
                            />
                          }
                          label={tc.subTitle}
                        />
                      ))}
                    </FormGroup>
                  )}
                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    Analysis Type
                  </Typography>

                  <FormControl fullWidth size="small">
                    <InputLabel>Analysis Type</InputLabel>

                    <Select
                      value={analysisType}
                      label="Analysis Type"
                      onChange={(e) => setAnalysisType(e.target.value)}
                    >
                      {ANALYSIS_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      mt: 2,
                      backgroundColor: LG_RED[100],
                    }}
                    disabled={
                      selectedTestCases.length === 0 ||
                      !analysisType ||
                      visibleSelectedModels.length === 0
                    }
                    onClick={handleRunAnalysis}
                  >
                    분석 실행
                  </Button>
                </>
              )}
            </Box>
          )}
        </Paper>

        {/* Main Area */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minWidth: 0,
          }}
        >
          {/* Selected Models */}
          <Paper sx={{ p: 2 }}>
            {modelError && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                onClose={() => setModelError("")}
              >
                {modelError}
              </Alert>
            )}

            {devMode && (
              <Box
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 2,
                  border: "1px dashed",
                  borderColor: "divider",
                  bgcolor: "grey.50",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 1 }}
                >
                  개발 모드: Test Item / Analysis Type 조합으로 데모 모델을
                  불러옵니다.
                </Typography>

                {Object.entries(DEV_MODEL_MAP).map(
                  ([testItemLabel, analysisMap]) => (
                    <Box key={testItemLabel} sx={{ mb: 1.5 }}>
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{ mb: 0.75 }}
                      >
                        {testItemLabel}
                      </Typography>

                      <Box
                        sx={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 0.75,
                        }}
                      >
                        {Object.entries(analysisMap).map(([type, modelIds]) => {
                          const disabled = modelIds.length === 0;
                          const devModelIds = modelIds.map(
                            (item) => item.modelId,
                          );
                          const isActive =
                            analysisType === type &&
                            selectedModels.length > 0 &&
                            selectedModels.every((model) =>
                              devModelIds.includes(model.model_id),
                            );

                          return (
                            <Button
                              key={`${testItemLabel}-${type}`}
                              size="small"
                              variant={isActive ? "contained" : "outlined"}
                              disabled={modelLoading || disabled}
                              onClick={() => loadDevModels(testItemLabel, type)}
                              sx={{
                                minWidth: 64,
                                borderRadius: 999,
                                textTransform: "none",
                                fontSize: 12,
                                ...(isActive
                                  ? {
                                      bgcolor: LG_RED[100],
                                      borderColor: LG_RED[100],
                                      color: "#fff",
                                      "&:hover": {
                                        bgcolor: LG_RED[100],
                                      },
                                    }
                                  : {}),
                              }}
                            >
                              {DEV_ANALYSIS_TYPE_LABELS[type] ?? type}
                              {modelIds.length > 0
                                ? ` (${modelIds.length})`
                                : ""}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  ),
                )}
              </Box>
            )}

            {modelLoading ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  py: 2,
                }}
              >
                <CircularProgress size={20} />

                <Typography variant="body2" color="text.secondary">
                  모델 정보를 불러오고 있습니다.
                </Typography>
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, minmax(0, 1fr))",
                      md: "repeat(3, minmax(0, 1fr))",
                      lg: "repeat(4, minmax(0, 1fr))",
                    },
                    gap: 1.5,
                    alignItems: "stretch",
                  }}
                >
                  {selectedModels.map((model, modelIndex) => {
                    const isHidden = hiddenModelKeys.includes(model.card_key);

                    const isDragging = draggedModelKey === model.card_key;

                    const isDragOver =
                      dragOverModelKey === model.card_key &&
                      draggedModelKey !== model.card_key;

                    return (
                      <React.Fragment key={model.card_key}>
                        {dropIndex === modelIndex && (
                          <Box
                            sx={{
                              position: "absolute",
                              width: 4,
                              height: 132,
                              bgcolor: "#A50034",
                              borderRadius: 1,
                              zIndex: 10,
                            }}
                          />
                        )}

                        <Paper
                          key={model.card_key}
                          variant="outlined"
                          draggable
                          onDragStart={(event) => {
                            setDraggedModelKey(model.card_key);
                            setDragOverModelKey(null);

                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData(
                              "text/plain",
                              model.card_key,
                            );
                          }}
                          onDragEnter={(event) => {
                            event.preventDefault();

                            if (
                              !draggedModelKey ||
                              draggedModelKey === model.card_key
                            ) {
                              return;
                            }

                            setDragOverModelKey(model.card_key);
                            setDropIndex(modelIndex);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();

                            if (
                              draggedModelKey &&
                              dragOverModelKey &&
                              draggedModelKey !== dragOverModelKey
                            ) {
                              handleMoveSelectedModel(
                                draggedModelKey,
                                dragOverModelKey,
                              );
                            }

                            setDraggedModelKey(null);
                            setDragOverModelKey(null);
                          }}
                          onDragEnd={() => {
                            setDraggedModelKey(null);
                            setDragOverModelKey(null);
                            setDropIndex(null);
                          }}
                          sx={{
                            p: 1.5,
                            minHeight: 132,
                            borderRadius: 1,
                            position: "relative",
                            overflow: "hidden",
                            cursor: "grab",

                            opacity: isDragging ? 0.35 : isHidden ? 0.45 : 1,

                            transform: "none",

                            borderColor: "divider",

                            borderWidth: 1,

                            bgcolor: isHidden ? "grey.50" : "background.paper",

                            boxShadow: 0,

                            transition: "all 200ms cubic-bezier(0.2, 0, 0, 1)",
                            "&:active": {
                              cursor: "grabbing",
                            },
                            "&::before": isDragOver
                              ? {
                                  content: '""',
                                  position: "absolute",
                                  left: -12,
                                  top: 12,
                                  bottom: 12,
                                  width: 4,
                                  bgcolor: "#A50034",
                                  borderRadius: 999,
                                  zIndex: 20,
                                }
                              : undefined,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              gap: 1,
                              pl: 0.5,
                              mb: 1,
                            }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.75,
                                  flexWrap: "wrap",
                                }}
                              >
                                {modelIndex === 0 && (
                                  <Chip
                                    label="기준 모델"
                                    size="small"
                                    sx={{
                                      height: 22,
                                      fontSize: 10,
                                      bgcolor: LG_RED[100],
                                      color: "#fff",
                                      fontWeight: 800,
                                    }}
                                  />
                                )}

                                <Typography
                                  variant="subtitle2"
                                  fontWeight={800}
                                  noWrap
                                  title={`${model.grade} ${model.model_suffix}`}
                                >
                                  {model.model_id} | {model.model_suffix}
                                </Typography>

                                <Chip
                                  label={model.event}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: 11,
                                    bgcolor: LG_RED.a48,
                                    color: LG_RED[100],
                                    fontWeight: 700,
                                  }}
                                />

                                <Chip
                                  label={model.grade}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: 11,
                                    bgcolor: LG_RED.a48,
                                    color: LG_RED[100],
                                    fontWeight: 700,
                                  }}
                                />
                              </Box>
                            </Box>

                            <Box sx={{ display: "flex", flexShrink: 0 }}>
                              <IconButton
                                size="small"
                                onClick={() =>
                                  handleToggleModelHidden(model.card_key)
                                }
                                title={isHidden ? "다시 표시" : "숨기기"}
                              >
                                {isHidden ? (
                                  <VisibilityOutlinedIcon fontSize="small" />
                                ) : (
                                  <VisibilityOffOutlinedIcon fontSize="small" />
                                )}
                              </IconButton>

                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  handleDeleteModel(model.card_key)
                                }
                                title="삭제"
                              >
                                <DeleteOutlineOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              pl: 0.5,
                              mb: 1,
                              color: "text.secondary",
                              wordBreak: "break-all",
                            }}
                          >
                            {model.serial_no}
                          </Typography>

                          <Divider sx={{ my: 1 }} />

                          <Box sx={{ display: "grid", gap: 0.4, pl: 0.5 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {model.user} | {model.test_room} |{" "}
                              {formatMeasuredTime(model.measured_time)}
                            </Typography>
                          </Box>
                        </Paper>
                      </React.Fragment>
                    );
                  })}

                  {/* 모델 추가 카드 */}
                  <Tooltip
                    title={
                      selectionContext
                        ? "Setting 조건으로 비교 모델 조회"
                        : "Test Item과 Test Case를 먼저 선택해 주세요."
                    }
                    arrow
                  >
                    <Box
                      component="button"
                      type="button"
                      disabled={!selectionContext || candidateModelsLoading}
                      onClick={handleOpenModelPicker}
                      sx={{
                        minHeight: 132,
                        height: "100%",
                        border: "2px dashed",
                        borderColor: selectionContext ? LG_RED[100] : "divider",
                        borderRadius: 1,
                        bgcolor: selectionContext ? LG_RED.a06 : "grey.50",
                        color: selectionContext ? LG_RED[100] : "text.disabled",
                        cursor: selectionContext ? "pointer" : "not-allowed",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.75,
                        fontFamily: "inherit",
                        transition:
                          "transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease",

                        "&:hover": selectionContext
                          ? {
                              bgcolor: LG_RED.a12 ?? LG_RED.a06,
                              borderColor: LG_RED[100],
                              transform: "translateY(-2px)",
                              boxShadow: 2,
                            }
                          : {},

                        "&:disabled": {
                          opacity: 0.6,
                        },
                      }}
                    >
                      <AddIcon
                        sx={{
                          fontSize: 34,
                        }}
                      />

                      <Typography
                        component="span"
                        variant="body2"
                        fontWeight={700}
                      >
                        모델 추가
                      </Typography>

                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          color: selectionContext
                            ? "text.secondary"
                            : "text.disabled",
                        }}
                      >
                        Setting 기준 모델 조회
                      </Typography>
                    </Box>
                  </Tooltip>
                </Box>
              </>
            )}
          </Paper>

          {/* Comparison Summary */}
          <Paper sx={{ p: 2, minHeight: 180 }}>
            <Typography variant="h6">Comparison Summary</Typography>
          </Paper>

          {/* Detailed Comparison Results */}
          <Paper
            sx={{
              p: 2,
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Box sx={{ mb: 2, flexShrink: 0 }}>
              <Typography variant="h6">Detailed Comparison Results</Typography>
            </Box>

            {comparisonError && (
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                onClose={() => setComparisonError("")}
              >
                {comparisonError}
              </Alert>
            )}

            {comparisonLoading ? (
              <Box
                sx={{
                  minHeight: 160,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <CircularProgress size={22} />

                <Typography variant="body2" color="text.secondary">
                  모델별 Test Case 데이터를 불러오고 있습니다.
                </Typography>
              </Box>
            ) : !analysisExecuted ? (
              <Box
                sx={{
                  minHeight: 140,
                  border: "1px dashed",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "grey.50",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  px: 2,
                  textAlign: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  모델과 Test Case를 선택한 후 분석 실행 버튼을 눌러 주세요.
                </Typography>
              </Box>
            ) : comparisonRows.length === 0 ? (
              <Alert severity="info">
                선택한 모델과 Test Case에 해당하는 측정 결과가 없습니다.
              </Alert>
            ) : (
              <TableContainer
                sx={{
                  overflow: "visible",
                  flexShrink: 0,

                  // maxHeight: 520,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    minWidth: Math.max(
                      900,
                      420 + visibleSelectedModels.length * 190,
                    ),

                    "& .MuiTableCell-root": {
                      borderRight: "1px solid",
                      borderRightColor: "divider",
                    },
                  }}
                >
                  <TableHead>
                    {/* 1행: 모델 정보 */}
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        sx={{
                          minWidth: 420,
                          bgcolor: "grey.100",
                          fontWeight: 800,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                        }}
                      >
                        모델명 / Event (시료 번호)
                      </TableCell>

                      {visibleSelectedModels.map((model, modelIndex) => (
                        <TableCell
                          key={model.card_key}
                          align="center"
                          sx={{
                            minWidth: 190,
                            bgcolor: modelIndex === 0 ? LG_RED.a12 : "grey.50",
                            color:
                              modelIndex === 0 ? LG_RED[100] : "text.primary",
                            fontWeight: 800,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 0.25,
                            }}
                          >
                            {modelIndex === 0 && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{
                                  color: LG_RED[100],
                                  fontWeight: 800,
                                }}
                              >
                                기준 모델
                              </Typography>
                            )}

                            <Typography
                              component="span"
                              variant="body2"
                              fontWeight={800}
                            >
                              {model.model_suffix || "-"}
                            </Typography>

                            <Typography
                              component="span"
                              variant="caption"
                              color="text.secondary"
                            >
                              {model.event || "-"} ({model.serial_no || "-"})
                            </Typography>
                          </Box>
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* 2행: 열 제목 및 특이사항 */}
                    <TableRow>
                      <TableCell
                        sx={{
                          minWidth: 280,
                          bgcolor: "grey.100",
                          fontWeight: 800,
                          textAlign: "center",
                        }}
                      >
                        시험항목
                      </TableCell>

                      <TableCell
                        sx={{
                          minWidth: 140,
                          bgcolor: "grey.100",
                          fontWeight: 800,
                          textAlign: "center",
                        }}
                      >
                        Spec
                      </TableCell>

                      {visibleSelectedModels.map((model) => (
                        <TableCell
                          key={`remark:${model.card_key}`}
                          align="center"
                          sx={{
                            minWidth: 190,
                            bgcolor: "grey.50",
                            p: 1,
                            verticalAlign: "top",
                          }}
                        >
                          <TextField
                            value={
                              comparisonRemarksByModel[model.card_key] ?? ""
                            }
                            onChange={handleComparisonRemarkChange(
                              model.card_key,
                            )}
                            placeholder="특이사항 입력"
                            size="small"
                            fullWidth
                            multiline
                            minRows={1}
                            maxRows={3}
                            inputProps={{
                              "aria-label": `${model.model_suffix} 특이사항 작성`,
                            }}
                            sx={{
                              "& .MuiInputBase-root": {
                                fontSize: 12,
                                bgcolor: "background.paper",
                              },
                            }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {comparisonRows.map((row) => {
                      const rowSpec = getComparisonRowSpec(row);

                      return (
                        <TableRow
                          key={
                            row.matrixKey ?? `${row.parent_tc_id}:${row.TC_ID}`
                          }
                          hover
                        >
                          {/* 시험항목 */}
                          <TableCell
                            sx={{
                              minWidth: 280,
                              maxWidth: 380,
                              verticalAlign: "top",
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.35,
                              }}
                            >
                              <Typography variant="body2" fontWeight={700}>
                                {row.Test_Name || "-"}
                              </Typography>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {row.TC_ID}
                              </Typography>

                              {row.Options && row.Options !== "-" && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {row.Options}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>

                          {/* Spec */}
                          <TableCell
                            align="center"
                            sx={{
                              minWidth: 140,
                              whiteSpace: "normal",
                              verticalAlign: "middle",
                            }}
                          >
                            <Typography variant="body2" fontWeight={700}>
                              {formatMeasurementSpec(rowSpec)}
                            </Typography>
                          </TableCell>

                          {/* 모델별 Result */}
                          {visibleSelectedModels.map((model) => {
                            const modelResult =
                              row.resultsByModel?.[model.card_key];

                            const ng = isNgJudge(modelResult?.Judge);

                            return (
                              <TableCell
                                key={`${row.matrixKey}:${model.card_key}`}
                                align="center"
                                sx={{
                                  minWidth: 190,
                                  verticalAlign: "middle",
                                  bgcolor: ng
                                    ? "rgba(229, 83, 61, 0.08)"
                                    : "background.paper",
                                }}
                              >
                                {!modelResult ? (
                                  <Typography
                                    variant="body2"
                                    color="text.disabled"
                                  >
                                    -
                                  </Typography>
                                ) : (
                                  <Tooltip
                                    arrow
                                    title={
                                      <Box>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            display: "block",
                                          }}
                                        >
                                          Judge: {modelResult.Judge || "-"}
                                        </Typography>

                                        {modelResult.Judge_Comment && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: "block",
                                            }}
                                          >
                                            Comment: {modelResult.Judge_Comment}
                                          </Typography>
                                        )}

                                        {modelResult.Sample && (
                                          <Typography
                                            variant="caption"
                                            sx={{
                                              display: "block",
                                            }}
                                          >
                                            Sample: {modelResult.Sample}
                                          </Typography>
                                        )}
                                      </Box>
                                    }
                                  >
                                    <Box
                                      sx={{
                                        display: "inline-flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 0.25,
                                      }}
                                    >
                                      <Typography
                                        variant="body2"
                                        fontWeight={ng ? 800 : 700}
                                        sx={{
                                          color: ng
                                            ? "#D32F2F"
                                            : "text.primary",
                                        }}
                                      >
                                        {formatMeasurementResult({
                                          result: modelResult.Result,
                                          unit: modelResult.Unit ?? row.Unit,
                                        })}
                                      </Typography>

                                      {ng && (
                                        <Typography
                                          component="span"
                                          variant="caption"
                                          sx={{
                                            color: "#D32F2F",
                                            fontWeight: 800,
                                          }}
                                        >
                                          NG
                                        </Typography>
                                      )}
                                    </Box>
                                  </Tooltip>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Ask AI */}
          {showAiChat && (
            <Paper
              sx={{
                p: 1.5,
                flexShrink: 0,
              }}
            >
              <TextField
                fullWidth
                size="small"
                placeholder="Ask AI about the analysis results..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SmartToyOutlinedIcon sx={{ color: LG_RED[500] }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Paper>
          )}
        </Box>
      </Box>
      <Dialog
        open={modelPickerOpen}
        onClose={() => {
          if (!candidateModelsLoading) {
            setModelPickerOpen(false);
          }
        }}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>비교 모델 선택</DialogTitle>

        <DialogContent dividers>
          {/* 현재 Model 조회 기준 */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              {selectedTestItem}
            </Typography>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.25 }}
            >
              선택 Test Case: {selectedTestCases.join(", ")}
            </Typography>
          </Box>

          {/* Candidate 조회 기간 조건 */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              borderRadius: 1.5,
              bgcolor: "grey.50",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              조회 기간
            </Typography>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <TextField
                label="시작일"
                type="date"
                size="small"
                value={candidateDateRange.startDate}
                onChange={handleCandidateDateChange("startDate")}
                disabled={candidateModelsLoading}
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  max: candidateDateRange.endDate || undefined,
                }}
                sx={{
                  width: {
                    xs: "100%",
                    sm: 180,
                  },
                }}
              />

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  display: {
                    xs: "none",
                    sm: "block",
                  },
                }}
              >
                ~
              </Typography>

              <TextField
                label="종료일"
                type="date"
                size="small"
                value={candidateDateRange.endDate}
                onChange={handleCandidateDateChange("endDate")}
                disabled={candidateModelsLoading}
                InputLabelProps={{
                  shrink: true,
                }}
                inputProps={{
                  min: candidateDateRange.startDate || undefined,
                }}
                sx={{
                  width: {
                    xs: "100%",
                    sm: 180,
                  },
                }}
              />

              <Button
                variant="contained"
                onClick={handleSearchCandidateModels}
                disabled={
                  candidateModelsLoading ||
                  !candidateDateRange.startDate ||
                  !candidateDateRange.endDate
                }
                sx={{
                  minWidth: 88,
                  bgcolor: LG_RED[100],
                  "&:hover": {
                    bgcolor: "#820029",
                  },
                }}
              >
                조회
              </Button>

              <Typography variant="caption" color="text.secondary">
                기본 조회 기간은 최근 3개월입니다.
              </Typography>
            </Box>
          </Paper>

          {candidateModelsError && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              onClose={() => setCandidateModelsError("")}
            >
              {candidateModelsError}
            </Alert>
          )}

          {candidateModelsLoading ? (
            <Box
              sx={{
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1.25,
                textAlign: "center",
              }}
            >
              <CircularProgress size={26} />

              <Typography variant="body2" fontWeight={600}>
                {candidateLoadProgress.total > 0
                  ? `모델별 Sample 정보를 조회하고 있습니다. ${candidateLoadProgress.completed} / ${candidateLoadProgress.total}`
                  : "조회 대상 모델을 확인하고 있습니다."}
              </Typography>

              <Typography variant="caption" color="text.secondary">
                조회 기간: {candidateDateRange.startDate} ~{" "}
                {candidateDateRange.endDate}
              </Typography>
            </Box>
          ) : candidateModelsError ? null : candidateModels.length === 0 ? (
            <Alert severity="info">
              선택한 기간과 Test Case에 해당하는 모델 및 Sample이 없습니다.
            </Alert>
          ) : (
            <>
              {/* Candidate Table */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  조회 결과 {candidateModels.length}건
                  {candidateModels.length !== filteredCandidateModels.length &&
                    ` / 필터 결과 ${filteredCandidateModels.length}건`}
                </Typography>
                 
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<RestartAltOutlinedIcon />}
                  onClick={handleResetCandidateFilters}
                  sx={{
                    textTransform: "none",
                    color: "text.secondary",
                  }}
                >
                  필터 초기화
                </Button>
              </Box>

              <TableContainer
                sx={{
                  maxHeight: 520,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    minWidth: isMechAioCandidateSource ? 1780 : 1280,
                  }}
                >
                  <TableHead>
                    {/* Column Header */}
                    <TableRow>
                      <TableCell
                        padding="checkbox"
                        sx={{
                          bgcolor: "background.paper",
                        }}
                      />

                      {candidateTableColumns.map((column) => (
                        <TableCell
                          key={column.field}
                          sx={{
                            minWidth: column.minWidth,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            bgcolor: "background.paper",
                          }}
                        >
                          {column.label}
                        </TableCell>
                      ))}
                    </TableRow>

                    {/* Filter Header */}
                    <TableRow>
                      <TableCell
                        padding="checkbox"
                        sx={{
                          bgcolor: "grey.50",
                        }}
                      />

                      {candidateTableColumns.map((column) => (
                        <TableCell
                          key={column.field}
                          sx={{
                            minWidth: column.minWidth,
                            bgcolor: "grey.50",
                            py: 0.75,
                          }}
                        >
                          <TextField
                            value={candidateFilters[column.field] ?? ""}
                            onChange={handleCandidateFilterChange(column.field)}
                            placeholder={column.placeholder}
                            size="small"
                            variant="outlined"
                            fullWidth
                            inputProps={{
                              "aria-label": `${column.label} 필터`,
                            }}
                            sx={{
                              minWidth: column.minWidth,

                              "& .MuiInputBase-root": {
                                height: 32,
                                fontSize: 12,
                                bgcolor: "background.paper",
                              },
                            }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredCandidateModels.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={candidateTableColumns.length + 1}
                          align="center"
                          sx={{ py: 5 }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            필터 조건에 해당하는 결과가 없습니다.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredCandidateModels.map((candidate) => {
                        const checked = selectedCandidateKeys.includes(
                          candidate.candidateKey,
                        );

                        return (
                          <TableRow
                            key={candidate.candidateKey}
                            hover
                            selected={checked}
                            onClick={() =>
                              handleToggleCandidate(candidate.candidateKey)
                            }
                            sx={{
                              cursor: "pointer",

                              "& .MuiTableCell-root": {
                                verticalAlign: "middle",
                              },
                            }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={checked}
                                onChange={() =>
                                  handleToggleCandidate(candidate.candidateKey)
                                }
                                onClick={(event) => event.stopPropagation()}
                              />
                            </TableCell>

                            {/* ID */}
                            <TableCell>{candidate.modelId}</TableCell>

                            {/* Model */}
                            <TableCell
                              sx={{
                                minWidth: 220,
                                maxWidth: 320,
                              }}
                            >
                              <Typography
                                variant="body2"
                                noWrap
                                title={candidate.modelName || ""}
                              >
                                {candidate.modelName || "-"}
                              </Typography>
                            </TableCell>

                            {/* Sample (Serial No) */}
                            <TableCell
                              sx={{
                                minWidth: 150,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {candidate.sample || candidate.serialNo || "-"}
                            </TableCell>

                            {/* MechAIO Test Cases */}
                            {isMechAioCandidateSource && (
                              <TableCell
                                sx={{
                                  minWidth: 220,
                                }}
                              >
                                <TestCaseBadges candidate={candidate} />
                              </TableCell>
                            )}

                            {/* Inch */}
                            <TableCell>{candidate.inch ?? "-"}</TableCell>

                            {/* MechAIO Grade */}
                            {isMechAioCandidateSource && (
                              <TableCell>{candidate.grade || "-"}</TableCell>
                            )}

                            {/* Event */}
                            <TableCell>{candidate.event || "-"}</TableCell>

                            {/* Tool */}
                            <TableCell>{candidate.tool || "-"}</TableCell>

                            {/* MechAIO Maker / Part */}
                            {isMechAioCandidateSource && (
                              <>
                                <TableCell>
                                  {candidate.panelMaker || "-"}
                                </TableCell>

                                <TableCell>{candidate.part || "-"}</TableCell>
                              </>
                            )}

                            {/* User */}
                            <TableCell>{candidate.user || "-"}</TableCell>

                            {/* Test Room */}
                            <TableCell>
                              {candidate.measuredSite || "-"}
                            </TableCell>

                            {/* Seq */}
                            <TableCell>{candidate.sequence ?? "-"}</TableCell>

                            {/* Measured Time */}
                            <TableCell
                              sx={{
                                minWidth: 180,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatMeasuredTime(candidate.measuredTime)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => setModelPickerOpen(false)}
            disabled={candidateModelsLoading}
          >
            취소
          </Button>

          <Button
            variant="contained"
            disabled={
              candidateModelsLoading || selectedCandidateKeys.length === 0
            }
            onClick={handleConfirmCandidateModels}
            sx={{
              bgcolor: LG_RED[100],

              "&:hover": {
                bgcolor: "#820029",
              },
            }}
          >
            {selectedCandidateKeys.length}개 추가
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  );
}
