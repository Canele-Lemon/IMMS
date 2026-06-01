function getSVRootPath(model) {
  if (!model?.measured_site) return null;

  if (model.measured_site.includes("KR")) return "TV_KR_RND";
  if (model.measured_site.includes("RC")) return "TV_RC_RND";

  return null;
}

function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  const target = numberInfoList.find(
    (item) => String(item.number) === String(selectedSample)
  );

  if (!target?.data) return [];

  const preq = target.data.preq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

  const length = Math.min(preq.length, spec.length, rattle.length);

  return Array.from({ length }, (_, i) => ({
    x: Number(preq[i]),
    spec: Number(spec[i]),
    measurement: Number(rattle[i]),
    margin: Number(spec[i]) - Number(rattle[i]),
  })).filter(
    (d) =>
      Number.isFinite(d.x) &&
      Number.isFinite(d.spec) &&
      Number.isFinite(d.measurement)
  );
}

const loadSVRawDataFromApi = async ({ model }) => {
  const rootPath = getSVRootPath(model);

  if (!rootPath || !model?.id) {
    return [];
  }

  const res = await axios.get(`${BASE_URL()}/sound/file/sv/raw-data`, {
    params: {
      root_path: rootPath,
      no: model.id,
      target_test_type: "SV",
    },
  });

  const files = res.data?.files ?? [];
  if (!files.length) return [];

  const firstFile = files[0];
  return firstFile.number_info ?? [];
};

const [excelData, setExcelData] = useState([]);
const [svRawNumberInfo, setSvRawNumberInfo] = useState([]);

useEffect(() => {
  if (!selectedModel || !selectedTestCase || !selectedSample) {
    ...
  }

  const filePath = getLocalFilePath({
    model: selectedModel,
    testCase: selectedTestCase,
  });

  ...
}, [selectedModel, selectedTestCase, selectedSample, attachments]);

useEffect(() => {
  if (!selectedModel || selectedTestCase !== "Sound Vibration") {
    setSvRawNumberInfo([]);
    setExcelData([]);
    setSvHoverPoint(null);
    setLoadingChart(false);
    return;
  }

  let cancelled = false;

  setLoadingChart(true);
  setExcelData([]);
  setSvHoverPoint(null);

  loadSVRawDataFromApi({ model: selectedModel })
    .then((numberInfoList) => {
      if (cancelled) return;
      setSvRawNumberInfo(numberInfoList);
    })
    .catch((err) => {
      if (cancelled) return;
      console.error("SV raw-data API error:", err);
      setSvRawNumberInfo([]);
      setExcelData([]);
    })
    .finally(() => {
      if (cancelled) return;
      setLoadingChart(false);
    });

  return () => {
    cancelled = true;
  };
}, [selectedModel, selectedTestCase]);

useEffect(() => {
  if (
    selectedTestCase !== "Sound Vibration" ||
    !selectedSample ||
    !svRawNumberInfo.length
  ) {
    setExcelData([]);
    setSvHoverPoint(null);
    return;
  }

  const chartData = buildSVChartDataFromApi(svRawNumberInfo, selectedSample);

  setExcelData(chartData);
  setSvHoverPoint(null);
}, [selectedSample, selectedTestCase, svRawNumberInfo]);

