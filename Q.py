function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  console.log("===== SV Chart Build Debug =====");
  console.log("selectedSample:", selectedSample);
  console.log(
    "numberInfo numbers:",
    numberInfoList.map((item) => item.number)
  );
  console.log(
    "numberInfo sheet names:",
    numberInfoList.map((item) => item.sheet_name)
  );

  const target = numberInfoList.find(
    (item) => String(item.number) === String(selectedSample)
  );

  console.log("matched target:", target);

  if (!target?.data) return [];

  const preq = target.data.preq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

  console.log("preq length:", preq.length);
  console.log("spec length:", spec.length);
  console.log("rattle length:", rattle.length);
  console.log("first data:", {
    preq: preq[0],
    spec: spec[0],
    rattle: rattle[0],
  });

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

  console.log("===== SV API Request Debug =====");
  console.log("model.id:", model?.id);
  console.log("model.measured_site:", model?.measured_site);
  console.log("rootPath:", rootPath);

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

  console.log("SV API response:", res.data);

  const files = res.data?.files ?? [];
  console.log("files length:", files.length);

  if (!files.length) return [];

  const firstFile = files[0];
  console.log("firstFile:", firstFile);
  console.log("number_info:", firstFile.number_info);

  return firstFile.number_info ?? [];
};


function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  const target =
    numberInfoList.find(
      (item) => String(item.number) === String(selectedSample)
    ) ?? numberInfoList[0];

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

function buildSVChartDataFromApi(numberInfoList, selectedSample, samplesForDetail) {
  const sampleIndex = samplesForDetail.findIndex(
    (sample) => String(sample) === String(selectedSample)
  );

  const targetNumber = sampleIndex >= 0 ? sampleIndex + 1 : null;

  const target = numberInfoList.find(
    (item) => Number(item.number) === Number(targetNumber)
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


const chartData = buildSVChartDataFromApi(
  svRawNumberInfo,
  selectedSample,
  samplesForDetail
);

}, [selectedSample, selectedTestCase, svRawNumberInfo, samplesForDetail]);