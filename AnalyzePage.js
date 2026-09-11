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

  const mergedItems = mergeAnalyzeItems(
    selectedAnalyzeItems,
    validItems,
  );

  setSelectedAnalyzeItems(mergedItems);

  setComparisonData({});
  setComparisonError("");
  setAnalysisExecuted(false);
  autoRunExecutedRef.current = false;

  return mergedItems;
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
      models
        .map((model) => model.analyze_category_key)
        .filter(Boolean),
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
    setComparisonError(
      "Comparison Matrix 데이터를 불러오지 못했습니다.",
    );
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
    setAlertMessage(
      "기본 분석은 모델을 추가할 때 자동으로 실행됩니다.",
    );
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

const handleConfirmCandidateModels = async () => {

const mergedAnalyzeItems =
  addAnalyzeItemsToSelection(nextAnalyzeItems);

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


