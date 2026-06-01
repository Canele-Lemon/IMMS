===== SV API Request Debug =====
SoundNoisePage.js:3169 model.id: 3299
SoundNoisePage.js:3170 model.measured_site: TV_RC_DQA
SoundNoisePage.js:3171 rootPath: TV_RC_RND
SoundNoisePage.js:3185 SV API response: {root_path: 'TV_RC_RND', no: '3299', sub_path: '', target_test_type: 'SV', files: Array(1)}files: [{…}]no: "3299"root_path: "TV_RC_RND"sub_path: ""target_test_type: "SV"[[Prototype]]: Object
SoundNoisePage.js:3188 files length: 1
SoundNoisePage.js:3193 firstFile: {filename: '50NU850BPUA.AUSJPCX_PV_1_SV_NA_00.00.00_20260528-1…)-NOTE-(STBY)-NOTE-NOTE-NOTE_guftha.anyoga_NG.xls', object_name: 'DB2DB/TV_RC_RND/3299/50NU850BPUA.AUSJPCX_PV_1_SV_N…)-NOTE-(STBY)-NOTE-NOTE-NOTE_guftha.anyoga_NG.xls', number_info: Array(4)}filename: "50NU850BPUA.AUSJPCX_PV_1_SV_NA_00.00.00_20260528-1909_(STBY)-NOTE-(STBY)-NOTE-NOTE-NOTE_guftha.anyoga_NG.xls"number_info: (4) [{…}, {…}, {…}, {…}]object_name: "DB2DB/TV_RC_RND/3299/50NU850BPUA.AUSJPCX_PV_1_SV_NA_00.00.00_20260528-1909_(STBY)-NOTE-(STBY)-NOTE-NOTE-NOTE_guftha.anyoga_NG.xls"[[Prototype]]: Object
SoundNoisePage.js:3194 number_info: 


===== SV Chart Build Debug =====
SoundNoisePage.js:220 selectedSample: 119
SoundNoisePage.js:221 numberInfo numbers: 
(4) [1, 2, 3, 4]
0
: 
1
1
: 
2
2
: 
3
3
: 
4
length
: 
4
[[Prototype]]
: 
Array(0)
SoundNoisePage.js:225 numberInfo sheet names: 
(4) ['Raw_data (1)', 'Raw_data (2)', 'Raw_data (3)', 'Raw_data (4)']
0
: 
"Raw_data (1)"
1
: 
"Raw_data (2)"
2
: 
"Raw_data (3)"
3
: 
"Raw_data (4)"
length
: 
4

콘솔에 이렇게 찍히는데 그럼 문제 원인이 실제 sample 명하고 rawdata #1 ... 이 애들이 서로 매핑이 안되어서 그런건가요?
