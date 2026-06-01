curl -X 'GET' \
  'https://imms-be--8000--minyoung1-park.apps.hedej.lge.com/sound/file/sv/raw-data?root_path=TV_KR_RND&no=3284&target_test_type=SV' \
  -H 'accept: application/json'

Response
{
  "root_path": "TV_KR_RND",
  "no": "3284",
  "sub_path": "",
  "target_test_type": "SV",
  "files": [
    {
      "filename": "55NU855BPSA_PV_1_SV__00.00.00_20260527-1334_NOTE-NOTE-NOTE-NOTE-NOTE-NOTE_hyunsick1.kim_OK.xls",
      "object_name": "DB2DB/TV_KR_RND/3284/55NU855BPSA_PV_1_SV__00.00.00_20260527-1334_NOTE-NOTE-NOTE-NOTE-NOTE-NOTE_hyunsick1.kim_OK.xls",
      "number_info": [
        {
          "number": 1,
          "sheet_name": "Raw_data (1)",
          "data": {
            "preq": [
              61.54,
              64.68,
              ...
            "spec": [
              10.995,
              15.2275,
              18.612,
              27.934,
              30.476,
              33.445,
              34.901,
              36.045,
              37.536,
              ...
              "rattle": [
              14.7103393225771,
              16.2268352509046,
              17.8499443516832,
              22.4986701824627
                ...
              이런식으로 받는데, 위 코드에서 구현한 것처럼 Measured Site에 "KR"이 들어가는 경우는 root_path가 "TV_KR_RND"가 되어야 하고 "RC"가 들어가는 경우는 "TV_RC_RND"가 되어야 합니다. 
                또 Chart에서 X축은 "data"의 "preq", Y1축은 "data"의 "spec", Y2축은 "data"의 "rattle"로 현재 코드 로직 그대로 가면 됩니다.


                어떻게 수정하면 되는지 알려주세요.
                
              
              
