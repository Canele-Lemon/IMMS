{
  "root_path": "TV_RC_RND",
  "no": "3043",
  "sub_path": "",
  "target_test_type": "SV",
  "files": [
    {
      "filename": "50QNED8SBUA.AUSSLCX_DV_1_SV_26Y_NA_20260313-2107_9-25-23-14-12-10_ulya.aqilah_NG.xls",
      "object_name": "DB2DB/TV_RC_RND/3043/50QNED8SBUA.AUSSLCX_DV_1_SV_26Y_NA_20260313-2107_9-25-23-14-12-10_ulya.aqilah_NG.xls",
      "number_info": [
        {
          "number": 1,
          "sample": 10,
          "sheet_name": "Raw_data (1)",
          "data": {
            "preq": [
              61.55,
              64.69,

curl -X 'GET' \
  'https://imms-be--8000--minyoung1-park.apps.hedej.lge.com/sound/file/ss/raw-data?root_path=TV_RC_RND&no=3297&target_test_type=SS' \
  -H 'accept: application/json'

이렇게 보내면

{
  "root_path": "TV_RC_RND",
  "no": "3297",
  "sub_path": "",
  "target_test_type": "SS",
  "files": [
    {
      "filename": "50NU850BPUA.AUSJFCX_PV_1_SS_NA_00.00.00_20260528-1728_(STBY)-NOTE-NOTE-NOTE-(STBY)-NOTE_guftha.anyoga_OK.xls",
      "object_name": "DB2DB/TV_RC_RND/3297/50NU850BPUA.AUSJFCX_PV_1_SS_NA_00.00.00_20260528-1728_(STBY)-NOTE-NOTE-NOTE-(STBY)-NOTE_guftha.anyoga_OK.xls",
      "summary": {
        "no1": {
          "sample": 949,
          "data": [
            {
              "no": 1,
              "time": 2,
              "front_of_tv": 34.28,
              "mirror_effect": 34.58,
              "max_ch": "Ch 1",
              "max_spl": 34.28,
              "limit_level": 25
            },
            {
              "no": 2,
              "time": 3,
              "front_of_tv": 26.78,
              "mirror_effect": 27,
              "max_ch": "Ch 1",
              "max_spl": 26.78,
              "limit_level": 25
            }
          ]
        }
      },
      "raw_data": {
        "no1": {
          "warm_up": {
            "time": [
              1,
              2,
              ...
            ],
            "front": [
              -33.55,
              34.28,
              ...
              16.65,
              16.86
            ],
            "rear": [
              -33.45,
              35.09, 
              
              
              
