function buildSVChartDataFromApi(numberInfoList, selectedSample) {
  console.log("selectedSample:", selectedSample);
  console.log(
    "api sample list:",
    numberInfoList.map((item) => item.sample)
  );

  const target = numberInfoList.find(
    (item) => String(item.sample) === String(selectedSample)
  );

  console.log("matched target:", target);

  if (!target?.data) return [];

  const preq = target.data.preq ?? [];
  const spec = target.data.spec ?? [];
  const rattle = target.data.rattle ?? [];

  console.log("preq length:", preq.length);
  console.log("spec length:", spec.length);
  console.log("rattle length:", rattle.length);
  console.log("first:", preq[0], spec[0], rattle[0]);

  ...
}

const preq = target.data.preq ?? target.data.freq ?? [];


const handleOpenDetail = async (model, testCase) => {
  setSelectedModel(model);
  setSelectedTestCase(testCase);
  setSelectedSample("");
  setIsDetailOpen(true);

  setSampleInfo([]);
  setBigData([]);
  setAttachments([]);
  setExcelData([]);
  setSvRawNumberInfo([]);
  setSvHoverPoint(null);

  await fetchModelData(model);
};

onClick={(e) => {
  e.stopPropagation();
  handleOpenDetail(model, "Sound Vibration");
}}

onClick={(e) => {
  e.stopPropagation();
  handleOpenDetail(model, "Stick-Slip");
}}

setSelectedModel({
  ...model,
  sample_count: sampleCount,
});