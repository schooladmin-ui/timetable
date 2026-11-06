/**
 * 초고속 교사 개인 및 학급 시간표 검색 웹앱 (Google Apps Script)
 * - 하드코딩 샘플 데이터 완전 제거 버전
 * - 오직 스프레드시트의 '주간시간표' 시트와 '학급시간표' 시트 데이터만 파싱하여 동작합니다.
 */

var CACHE_KEY_TIMETABLE = 'TIMETABLE_REAL_SHEETS_V5';
var CACHE_KEY_PREFIX = 'TT_FAST_V6_';
var CACHE_CHUNK_SIZE = 80000; // 단일 키 100KB 제한을 안전하게 회피하는 80KB 청크
var CACHE_TTL_SECONDS = 21600; // 6시간 캐싱
var PROP_VERSION_KEY = 'TIMETABLE_VERSION_HASH_V5';
var PROP_SS_ID_KEY = 'SPREADSHEET_ID';

/**
 * 웹앱 진입점 (GET)
 * - 1순위: CacheService 멀티청크 캐시에서 파싱/직렬화 없이 JSON 문자열을 즉시 주입 (~5ms)
 * - 2순위: 캐시 미스(콜드 스타트) 시 스프레드시트 I/O로 화면 열림을 블로킹하지 않고
 *          즉시 HTML 셸을 반환(<50ms)하여 브라우저 localStorage 즉시 렌더링(0ms) 및 비동기 로딩 수행
 */
function doGet(e) {
  var template = findHtmlTemplate_();
  var cachedJson = getCachedJsonFast_();
  template.initialJson = cachedJson ? cachedJson : 'null';

  return template
    .evaluate()
    .setTitle('교사·학급 시간표 검색')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * index / Index HTML 템플릿 대소문자 안전 탐색
 */
function findHtmlTemplate_() {
  try {
    return HtmlService.createTemplateFromFile('index');
  } catch (e) {}
  var names = ['Index', 'index.html', 'Index.html'];
  for (var i = 0; i < names.length; i++) {
    try {
      var t = HtmlService.createTemplateFromFile(names[i]);
      if (t) return t;
    } catch (e2) {}
  }
  return HtmlService.createTemplateFromFile('index');
}

/**
 * 대용량 JSON 문자열도 100KB 단일 키 제한에 걸리지 않도록 분할 캐시에서 초고속 조회합니다.
 */
function getCachedJsonFast_() {
  try {
    var cache = CacheService.getScriptCache();
    var metaStr = cache.get(CACHE_KEY_PREFIX + 'META');
    if (!metaStr) return null;

    var count = parseInt(metaStr, 10);
    if (!count || count <= 0) return null;

    if (count === 1) {
      return cache.get(CACHE_KEY_PREFIX + '0') || null;
    }

    var keys = [];
    for (var i = 0; i < count; i++) {
      keys.push(CACHE_KEY_PREFIX + i);
    }
    var chunkMap = cache.getAll(keys);
    var parts = [];
    for (var j = 0; j < count; j++) {
      var part = chunkMap[CACHE_KEY_PREFIX + j];
      if (!part) return null;
      parts.push(part);
    }
    return parts.join('');
  } catch (e) {
    return null;
  }
}

/**
 * JSON 문자열을 80KB 청크로 분할하여 CacheService에 일괄 저장(putAll)합니다.
 */
function putCachedJson_(jsonStr) {
  if (!jsonStr) return;
  try {
    var cache = CacheService.getScriptCache();
    var totalLen = jsonStr.length;
    var count = Math.ceil(totalLen / CACHE_CHUNK_SIZE);
    var batch = {};
    batch[CACHE_KEY_PREFIX + 'META'] = String(count);
    for (var i = 0; i < count; i++) {
      batch[CACHE_KEY_PREFIX + i] = jsonStr.substring(
        i * CACHE_CHUNK_SIZE,
        (i + 1) * CACHE_CHUNK_SIZE
      );
    }
    cache.putAll(batch, CACHE_TTL_SECONDS);
  } catch (e) {}
}

/**
 * 캐시 일괄 무효화 헬퍼
 */
function clearTimetableCache_() {
  try {
    var cache = CacheService.getScriptCache();
    cache.removeAll([
      CACHE_KEY_PREFIX + 'META',
      CACHE_KEY_PREFIX + '0',
      CACHE_KEY_PREFIX + '1',
      CACHE_KEY_PREFIX + '2',
      CACHE_KEY_PREFIX + '3',
      CACHE_KEY_PREFIX + '4',
      CACHE_KEY_TIMETABLE,
      'FAST_TIMETABLE_PAYLOAD_V1',
      'TIMETABLE_REAL_SHEETS_V2'
    ]);
  } catch (e) {}
}

/**
 * 독립형(Standalone) 스크립트에서 스프레드시트 URL 또는 ID를 수동 연결할 때 호출하는 API
 */
function setSpreadsheetUrlOrId(inputStr) {
  var raw = String(inputStr || '').trim();
  if (!raw) {
    throw new Error('스프레드시트 URL 또는 ID를 입력해 주세요.');
  }
  var idMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  var ssId = idMatch ? idMatch[1] : raw;

  var ss = SpreadsheetApp.openById(ssId);
  PropertiesService.getScriptProperties().setProperty(PROP_SS_ID_KEY, ss.getId());

  clearTimetableCache_();
  return getTimetableData(true);
}

/**
 * 전체 시간표 데이터를 JSON 문자열로 초고속 반환합니다. (google.script.run 직렬화 오버헤드 제거)
 * @param {boolean} forceRefresh 캐시를 무시하고 스프레드시트에서 새로 읽어올지 여부
 */
function getTimetableJsonString(forceRefresh) {
  if (!forceRefresh) {
    var cached = getCachedJsonFast_();
    if (cached) {
      return cached;
    }
  }

  var payload = buildTimetablePayloadFromRealSheets_();
  var serialized = JSON.stringify(payload);

  if (payload && payload.ok) {
    putCachedJson_(serialized);
  }

  return serialized;
}

/**
 * 전체 시간표 데이터를 객체로 반환합니다.
 * @param {boolean} forceRefresh 캐시를 무시하고 스프레드시트에서 새로 읽어올지 여부
 */
function getTimetableData(forceRefresh) {
  if (!forceRefresh) {
    var cached = getCachedJsonFast_();
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        if (parsed && parsed.ok) {
          return parsed;
        }
      } catch (e) {}
    }
  }

  var payload = buildTimetablePayloadFromRealSheets_();

  if (payload && payload.ok) {
    try {
      putCachedJson_(JSON.stringify(payload));
    } catch (cacheErr) {}
  }

  return payload;
}

/**
 * 시트 수정 시 캐시 자동 무효화 (셀 편집 및 시트 구조 변경 모두 대응)
 */
function onEdit(e) {
  clearTimetableCache_();
}

function onChange(e) {
  clearTimetableCache_();
}

/**
 * 첫 화면을 캐시로 0ms 만에 즉시 표시한 직후, 백그라운드에서 스프레드시트 원본의 변경 여부를 검사하여
 * 데이터가 1글자라도 변경되었을 때만 최신 JSON 문자열을 반환합니다. (Stale-While-Revalidate)
 */
function checkAndRefreshIfChanged(clientSig) {
  var payload = buildTimetablePayloadFromRealSheets_();
  if (!payload || !payload.ok) {
    return { changed: false };
  }
  var serialized = JSON.stringify(payload);
  putCachedJson_(serialized);

  if (clientSig && payload.sig && clientSig === payload.sig) {
    return { changed: false, v: payload.v };
  }
  return { changed: true, json: serialized };
}

function computePayloadSignature_(classes, teachers, meta, teacherGroups, gradeSpecialRooms) {
  try {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      JSON.stringify({
        c: classes,
        t: teachers,
        m: meta,
        g: teacherGroups || [],
        sr: gradeSpecialRooms || {}
      }),
      Utilities.Charset.UTF_8
    );
    var hex = '';
    for (var i = 0; i < digest.length; i++) {
      var b = digest[i];
      var v = (b < 0 ? b + 256 : b).toString(16);
      hex += v.length === 1 ? '0' + v : v;
    }
    return hex;
  } catch (e) {
    return '';
  }
}

function updateVersionTimestamp_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
}

/**
 * 연결된 스프레드시트 인스턴스 반환 (바인딩 시트 우선 -> 저장된 SPREADSHEET_ID 순)
 */
function getTargetSpreadsheet_() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    ss = null;
  }
  if (ss) return ss;

  try {
    var savedId = PropertiesService.getScriptProperties().getProperty(PROP_SS_ID_KEY);
    if (savedId) {
      ss = SpreadsheetApp.openById(savedId);
    }
  } catch (e2) {
    ss = null;
  }
  return ss;
}

/**
 * 에러/미연결 상태 반환용 빈 페이로드 생성 (하드코딩 데이터 없음)
 */
function buildEmptyErrorPayload_(errorMsg, sheetNames) {
  return {
    ok: false,
    error: errorMsg || '스프레드시트 데이터를 불러올 수 없습니다.',
    sheetNames: sheetNames || [],
    v: updateVersionTimestamp_(),
    meta: {
      schoolName: '',
      schoolYear: new Date().getFullYear() + '학년도',
      semester: '시간표',
      slogan: '',
      periodTimes: ['08:20', '09:20', '10:20', '11:20', '13:10', '14:10', '15:10']
    },
    days: ['월', '화', '수', '목', '금'],
    maxPeriod: 7,
    classes: {},
    teachers: {},
    teacherGroups: []
  };
}

/**
 * 스프레드시트의 '주간시간표' 시트와 '학급시간표' 시트만 읽어서 데이터를 정규화합니다.
 */
function buildTimetablePayloadFromRealSheets_() {
  var ss = getTargetSpreadsheet_();
  if (!ss) {
    return buildEmptyErrorPayload_(
      '연결된 구글 스프레드시트를 찾을 수 없습니다. 스프레드시트 내부 메뉴 [확장 프로그램 > Apps Script]에서 실행하거나, 아래 입력창에 스프레드시트 URL을 입력해 연결해 주세요.',
      []
    );
  }

  ensureDefaultSemesterSheetNames_(ss);

  var allSheets = ss.getSheets();
  var allSheetNames = allSheets.map(function (s) {
    return s.getName();
  });

  var semesterSets = discoverSemesterSheetSets_(ss);
  var props = PropertiesService.getScriptProperties();
  var savedActivePrefix = props.getProperty(PROP_ACTIVE_PROJECT_KEY) || '';
  var targetPrefix = normalizeSemesterPrefix_(savedActivePrefix || '2025-2');

  var selectedSet = null;
  for (var sIdx = 0; sIdx < semesterSets.length; sIdx++) {
    if (semesterSets[sIdx].prefix === targetPrefix) {
      selectedSet = semesterSets[sIdx];
      break;
    }
  }
  if (!selectedSet && semesterSets.length > 0) {
    selectedSet =
      semesterSets.filter(function (s) {
        return s.prefix === '2025-2';
      })[0] || semesterSets[0];
    targetPrefix = selectedSet.prefix;
  }

  var weeklySheet = selectedSet ? selectedSet.weeklySheet : null;
  var classSheet = selectedSet ? selectedSet.classSheet : null;

  if (!weeklySheet && !classSheet) {
    weeklySheet = findSheetByNameCandidates_(allSheets, allSheetNames, [
      '2025-2주간시간표',
      '주간시간표',
      '주간 시간표'
    ]);
    classSheet = findSheetByNameCandidates_(allSheets, allSheetNames, [
      '2025-2학급시간표',
      '학급시간표',
      '학급 시간표',
      '반별시간표'
    ]);
  }

  if (!weeklySheet && !classSheet) {
    return buildEmptyErrorPayload_(
      '스프레드시트에서 [20XX-X주간시간표] 또는 [20XX-X학급시간표] 시트를 찾을 수 없습니다. 현재 시트 목록: [' +
        allSheetNames.join(', ') +
        ']',
      allSheetNames
    );
  }

  var prefixYearMatch = targetPrefix.match(/^(20\d{2})-([12])$/);
  var defaultYearStr = (prefixYearMatch ? prefixYearMatch[1] : new Date().getFullYear()) + '학년도';
  var defaultSemStr = prefixYearMatch ? prefixYearMatch[2] + '학기' : '시간표';

  var meta = {
    schoolName: '',
    schoolYear: defaultYearStr,
    semester: defaultSemStr,
    slogan: '',
    weekRange: '',
    periodTimes: ['', '', '', '', '', '', '']
  };

  var store = {
    maxPeriod: 7,
    classes: {},
    teachers: {},
    gradeSpecialRooms: {},
    hasTeacherInClassCells: false
  };

  // 1. 학급시간표 시트 파싱
  if (classSheet) {
    parseSheetAutoLayout_(classSheet, 'class', store, meta);
  }

  // 2. 주간시간표 시트 파싱
  if (weeklySheet) {
    parseSheetAutoLayout_(weeklySheet, 'teacher', store, meta);
  }

  if (prefixYearMatch) {
    meta.schoolYear = prefixYearMatch[1] + '학년도';
    meta.semester = prefixYearMatch[2] + '학기';
  }

  // 3. 주간시간표 <-> 학급시간표 양방향 교차 매핑 (빠진 교사명/과목명/학급 시간표 상호 보완)
  crossEnrichTimetables_(store);

  // 3-2. 선택과목2학년 · 선택과목3학년 시트 탐색 및 강의실-학급 매칭 보정
  var elective2Sheet =
    (selectedSet && selectedSet.elective2Sheet) ||
    findElectiveSheetByGrade_(allSheets, allSheetNames, targetPrefix, 2);
  var elective3Sheet =
    (selectedSet && selectedSet.elective3Sheet) ||
    findElectiveSheetByGrade_(allSheets, allSheetNames, targetPrefix, 3);

  applyElectiveSheetsToStore_(store, elective2Sheet, elective3Sheet);

  var classCount = Object.keys(store.classes).length;
  var teacherCount = Object.keys(store.teachers).length;

  if (classCount === 0 && teacherCount === 0) {
    return buildEmptyErrorPayload_(
      '[' +
        (weeklySheet ? weeklySheet.getName() : targetPrefix + '주간시간표') +
        '] 및 [' +
        (classSheet ? classSheet.getName() : targetPrefix + '학급시간표') +
        '] 시트에서 유효한 시간표 데이터를 찾지 못했습니다. 시트 내 요일(월~금) 및 교시(1~7) 표 구조를 확인해 주세요.',
      allSheetNames
    );
  }

  // 4. 네트워크 전송 및 캐시 용량 최소화를 위해 빈 속성/중복 속성 경량화 (~60% 용량 절감)
  compactStoreForTransport_(store);

  // 5. 교사 그룹 시트('2026-2교사그룹' 또는 '<targetPrefix>교사그룹') 파싱
  var teacherGroupSheet = findTeacherGroupSheet_(allSheets, allSheetNames, targetPrefix);
  var teacherGroups = teacherGroupSheet ? parseTeacherGroupsFromSheet_(teacherGroupSheet) : [];

  var sig = computePayloadSignature_(
    store.classes,
    store.teachers,
    meta,
    teacherGroups,
    store.gradeSpecialRooms
  );

  var serializedSets = semesterSets.map(function (item) {
    return {
      id: item.prefix,
      prefix: item.prefix,
      name: item.name,
      weeklySheetName: item.weeklySheet ? item.weeklySheetName : '',
      classSheetName: item.classSheet ? item.classSheetName : '',
      elective2SheetName: item.elective2Sheet ? item.elective2SheetName : '',
      elective3SheetName: item.elective3Sheet ? item.elective3SheetName : ''
    };
  });

  return {
    ok: true,
    v: updateVersionTimestamp_(),
    sig: sig,
    activePrefix: targetPrefix,
    projectName: formatSemesterDisplayName_(targetPrefix),
    semesterSets: serializedSets,
    sheetNames: allSheetNames,
    foundSheets: {
      weekly: weeklySheet ? weeklySheet.getName() : null,
      classSheet: classSheet ? classSheet.getName() : null,
      elective2Sheet: elective2Sheet ? elective2Sheet.getName() : null,
      elective3Sheet: elective3Sheet ? elective3Sheet.getName() : null,
      teacherGroupSheet: teacherGroupSheet
        ? teacherGroupSheet.getName()
        : getTeacherGroupSheetName_(targetPrefix)
    },
    hasTeacherInClassCells: store.hasTeacherInClassCells,
    meta: meta,
    days: ['월', '화', '수', '목', '금'],
    maxPeriod: store.maxPeriod,
    classes: store.classes,
    teachers: store.teachers,
    gradeSpecialRooms: store.gradeSpecialRooms || {},
    teacherGroups: teacherGroups
  };
}

/**
 * 전송 및 캐시 용량 최소화를 위해 빈 속성(r:"", m:0, cc:0, st:"", 중복 키 등)을 제거합니다.
 */
function compactStoreForTransport_(store) {
  var maxP = store.maxPeriod;

  Object.keys(store.classes).forEach(function (cKey) {
    var cObj = store.classes[cKey];
    if (!cObj.homeroom) delete cObj.homeroom;
    var g = cObj.grid;
    for (var p = 0; p < maxP; p++) {
      if (!g[p]) continue;
      for (var d = 0; d < 5; d++) {
        var slot = g[p][d];
        if (!slot) continue;
        var compact = { s: slot.s || '' };
        if (slot.t) compact.t = slot.t;
        if (slot.r) compact.r = slot.r;
        if (slot.cc) compact.cc = 1;
        if (slot.st) compact.st = slot.st;
        if (slot.eg) compact.eg = slot.eg;
        g[p][d] = compact;
      }
    }
  });

  Object.keys(store.teachers).forEach(function (tKey) {
    var tObj = store.teachers[tKey];
    if (!tObj.subjectMain) delete tObj.subjectMain;
    if (!tObj.homeroomOf) delete tObj.homeroomOf;
    var g = tObj.grid;
    for (var p = 0; p < maxP; p++) {
      if (!g[p]) continue;
      for (var d = 0; d < 5; d++) {
        var slot = g[p][d];
        if (!slot) continue;
        var compact = {};
        if (slot.s) compact.s = slot.s;
        if (slot.c) compact.c = slot.c;
        if (slot.r) compact.r = slot.r;
        if (slot.cc) compact.cc = 1;
        if (slot.st) compact.st = slot.st;
        if (slot.eg) compact.eg = slot.eg;
        g[p][d] = compact;
      }
    }
  });

  if (store.gradeSpecialRooms) {
    Object.keys(store.gradeSpecialRooms).forEach(function (gKey) {
      var roomMap = store.gradeSpecialRooms[gKey] || {};
      Object.keys(roomMap).forEach(function (rKey) {
        var srObj = roomMap[rKey];
        if (!srObj) return;
        srObj.isSpecialRoom = true;
        var sg = srObj.grid || [];
        for (var p = 0; p < maxP; p++) {
          if (!sg[p]) continue;
          for (var d = 0; d < 5; d++) {
            var sSlot = sg[p][d];
            if (!sSlot) continue;
            var sComp = { s: sSlot.s || '' };
            if (sSlot.t) sComp.t = sSlot.t;
            if (sSlot.r) sComp.r = sSlot.r;
            if (sSlot.eg) sComp.eg = sSlot.eg;
            sg[p][d] = sComp;
          }
        }
      });
    });
  }
}

/**
 * 이미 조회한 시트 배열(allSheets, allSheetNames)에서 추가 RPC 호출 없이 인메모리로 시트 탐색
 */
function findSheetByNameCandidates_(sheets, sheetNames, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var exactIdx = sheetNames.indexOf(candidates[i]);
    if (exactIdx !== -1) return sheets[exactIdx];
  }
  var normalizedCandidates = candidates.map(function (c) {
    return c.replace(/\s+/g, '');
  });
  var normalizedSheetNames = sheetNames.map(function (n) {
    return n.replace(/\s+/g, '');
  });
  for (var j = 0; j < sheets.length; j++) {
    if (normalizedCandidates.indexOf(normalizedSheetNames[j]) !== -1) {
      return sheets[j];
    }
  }
  for (var k = 0; k < sheets.length; k++) {
    var sName2 = normalizedSheetNames[k];
    for (var m = 0; m < normalizedCandidates.length; m++) {
      if (sName2.indexOf(normalizedCandidates[m]) !== -1) {
        return sheets[k];
      }
    }
  }
  return null;
}

/**
 * 시트의 레이아웃(가로 매트릭스 / 세로 매트릭스 / 5열 블록형 / 목록형)을 자동 판별하여 파싱합니다.
 */
function parseSheetAutoLayout_(sheet, role, store, meta) {
  var rows = sheet.getDataRange().getDisplayValues();
  if (!rows || rows.length === 0) return;

  // 상단 텍스트에서 학년도/학기/학교명/주간날짜 메타 정보 추출
  extractMetaFromTopRows_(rows, meta);

  // 1순위: 가로형 매트릭스 (열 헤더가 월1~금7 또는 월~금 × 1~7교시, 각 행이 교사/학급)
  if (tryParseHorizontalMatrix_(rows, role, store, meta)) {
    return;
  }

  // 2순위: 세로형(전치) 매트릭스 (행이 월1~금7, 열 헤더가 교사/학급)
  if (tryParseVerticalMatrix_(rows, role, store, meta)) {
    return;
  }

  // 3순위: 5열 주간 그리드 블록형 (단일 또는 복수의 '교시 | 월 | 화 | 수 | 목 | 금' 표 블록)
  if (tryParseFiveDayBlocks_(rows, role, store, meta, sheet.getName())) {
    return;
  }

  // 4순위: 정규화된 행 목록형 (요일 | 교시 | 학급 | 과목 | 교사 컬럼 테이블)
  tryParseFlatRowTable_(rows, role, store, meta);
}

/**
 * 상단 행들에서 학년도, 학기, 학교명, 날짜 범위 추출
 */
function extractMetaFromTopRows_(rows, meta) {
  var maxScan = Math.min(8, rows.length);
  for (var r = 0; r < maxScan; r++) {
    for (var c = 0; c < Math.min(15, rows[r].length); c++) {
      var txt = String(rows[r][c] || '').trim();
      if (!txt) continue;

      var yearMatch = txt.match(/(20\d{2}\s*학년도)/);
      if (yearMatch) meta.schoolYear = yearMatch[1].replace(/\s+/g, '');

      var semMatch = txt.match(/([12]\s*학기\s*시간표|[12]\s*학기)/);
      if (semMatch) meta.semester = semMatch[1].replace(/\s*시간표$/, '').trim();

      var schoolMatch = txt.match(/([가-힣A-Za-z]+(?:초등학교|중학교|고등학교|학교))/);
      if (schoolMatch && !meta.schoolName) meta.schoolName = schoolMatch[1];

      var rangeMatch = txt.match(/(20\d{2}[-./]\d{1,2}[-./]\d{1,2}\s*~\s*(?:20\d{2}[-./])?\d{1,2}[-./]\d{1,2})/);
      if (rangeMatch && !meta.weekRange) meta.weekRange = rangeMatch[1];
    }
  }
}

/**
 * [레이아웃 1] 가로형 매트릭스 파서 (열 = 월1..금7, 행 = 교사 또는 학급)
 */
function tryParseHorizontalMatrix_(rows, role, store, meta) {
  var maxScanRow = Math.min(12, rows.length);
  var colMap = null;
  var headerEndRow = -1;
  var firstScheduleCol = 9999;

  // 1-A: 단일 행에 '월1', '월2', '화1' 등이 결합된 헤더 탐색
  for (var r = 0; r < maxScanRow; r++) {
    var tempMap = {};
    var matchCount = 0;
    var minCol = 9999;
    for (var c = 0; c < rows[r].length; c++) {
      var dp = parseCombinedDayPeriod_(rows[r][c]);
      if (dp) {
        tempMap[c] = dp;
        matchCount++;
        if (c < minCol) minCol = c;
        if (dp.period > store.maxPeriod) store.maxPeriod = dp.period;
      }
    }
    if (matchCount >= 10) {
      colMap = tempMap;
      headerEndRow = r;
      firstScheduleCol = minCol;
      break;
    }
  }

  // 1-B: 2단 행 헤더 (윗행: 월~금 병합셀, 아랫행: 1~7교시 반복) 탐색
  if (!colMap) {
    for (var rP = 1; rP < maxScanRow; rP++) {
      var pCells = [];
      for (var c2 = 0; c2 < rows[rP].length; c2++) {
        var pInfo = parsePeriodCell_(rows[rP][c2]);
        if (pInfo) pCells.push({ col: c2, period: pInfo.period, time: pInfo.time });
      }
      // 교시 번호가 가로로 10개 이상 나열되어 있다면 가로 매트릭스!
      if (pCells.length >= 10) {
        var rD = rP - 1;
        var hasDayAbove = false;
        for (var checkR = rP - 1; checkR >= Math.max(0, rP - 3); checkR--) {
          var dayCnt = 0;
          for (var cd = 0; cd < rows[checkR].length; cd++) {
            if (parseDayCell_(rows[checkR][cd]) !== -1) dayCnt++;
          }
          if (dayCnt >= 3) {
            rD = checkR;
            hasDayAbove = true;
            break;
          }
        }

        var tempMap2 = {};
        var minCol2 = pCells[0].col;
        var currentDay = -1;
        var prevPeriod = 99;

        for (var c3 = minCol2; c3 < rows[rP].length; c3++) {
          if (hasDayAbove) {
            var dCand = parseDayCell_(rows[rD][c3]);
            if (dCand !== -1) currentDay = dCand;
          }
          var pObj = parsePeriodCell_(rows[rP][c3]);
          if (pObj) {
            if (!hasDayAbove) {
              if (pObj.period <= prevPeriod) currentDay++;
            } else if (currentDay === -1) {
              currentDay = 0;
            }
            prevPeriod = pObj.period;

            if (currentDay >= 0 && currentDay <= 4) {
              tempMap2[c3] = { dayIdx: currentDay, period: pObj.period };
              if (pObj.time && !meta.periodTimes[pObj.period - 1]) {
                meta.periodTimes[pObj.period - 1] = pObj.time;
              }
              if (pObj.period > store.maxPeriod) store.maxPeriod = pObj.period;
            }
          }
        }

        if (Object.keys(tempMap2).length >= 10) {
          colMap = tempMap2;
          headerEndRow = rP;
          firstScheduleCol = minCol2;
          break;
        }
      }
    }
  }

  if (!colMap) return false;

  // 좌측 메타 컬럼(교사명, 과목, 학급, 학년, 반, 담임 등) 헤더 역할 파악
  var leftHeaders = [];
  for (var lc = 0; lc < firstScheduleCol; lc++) {
    var hTxt = '';
    for (var hr = 0; hr <= headerEndRow; hr++) {
      hTxt += ' ' + String(rows[hr][lc] || '').replace(/\s+/g, '');
    }
    leftHeaders.push(hTxt.trim());
  }

  var prevEntity = null;

  for (var rowIdx = headerEndRow + 1; rowIdx < rows.length; rowIdx++) {
    var row = rows[rowIdx];
    var leftIdentity = extractRowIdentity_(row, firstScheduleCol, leftHeaders, role);

    // 스케줄 열에 데이터가 하나라도 있는지 확인
    var hasScheduleCell = false;
    for (var sc in colMap) {
      if (String(row[sc] || '').trim() !== '') {
        hasScheduleCell = true;
        break;
      }
    }
    if (!leftIdentity.key && !hasScheduleCell) continue;

    // 만약 좌측 식별자가 비어 있고 직전 행의 엔티티가 존재하면 (2행 병합 셀 구조: 1행 과목 / 2행 교사 또는 학급)
    if (!leftIdentity.key && prevEntity && hasScheduleCell) {
      for (var sc2 in colMap) {
        var subVal = String(row[sc2] || '').trim();
        if (!subVal) continue;
        var slot = colMap[sc2];
        appendSecondLineToSlot_(prevEntity, slot.period - 1, slot.dayIdx, subVal, role, store);
      }
      continue;
    }

    if (!leftIdentity.key) continue;

    prevEntity = registerEntityAndRowSlots_(leftIdentity, row, colMap, role, store);
  }

  return true;
}

/**
 * [레이아웃 2] 세로형(전치) 매트릭스 파서 (행 = 월1..금7, 열 헤더 = 교사 또는 학급)
 */
function tryParseVerticalMatrix_(rows, role, store, meta) {
  var maxScanCol = Math.min(5, rows[0] ? rows[0].length : 0);
  var rowMap = null;
  var scheduleStartRow = 9999;
  var lastHeaderCol = -1;

  // 2-A: 단일 열에 '월1', '월2' 등이 세로로 나열된 경우
  for (var c = 0; c < maxScanCol; c++) {
    var tempRowMap = {};
    var cnt = 0;
    var minRow = 9999;
    for (var r = 0; r < rows.length; r++) {
      var dp = parseCombinedDayPeriod_(rows[r][c]);
      if (dp) {
        tempRowMap[r] = dp;
        cnt++;
        if (r < minRow) minRow = r;
        if (dp.period > store.maxPeriod) store.maxPeriod = dp.period;
      }
    }
    if (cnt >= 10) {
      rowMap = tempRowMap;
      scheduleStartRow = minRow;
      lastHeaderCol = c;
      break;
    }
  }

  // 2-B: 2열 구조 (좌측 열: 월~금 세로 병합, 우측 열: 1~7교시 반복)
  if (!rowMap) {
    for (var cP = 1; cP < maxScanCol; cP++) {
      var pRows = [];
      for (var r2 = 0; r2 < rows.length; r2++) {
        var pObj = parsePeriodCell_(rows[r2][cP]);
        if (pObj) pRows.push({ row: r2, period: pObj.period, time: pObj.time });
      }
      if (pRows.length >= 10) {
        var cD = cP - 1;
        var tempRowMap2 = {};
        var minRow2 = pRows[0].row;
        var currDay = -1;
        var prevP = 99;

        for (var r3 = minRow2; r3 < rows.length; r3++) {
          var dCand = parseDayCell_(rows[r3][cD]);
          if (dCand !== -1) currDay = dCand;

          var pObj2 = parsePeriodCell_(rows[r3][cP]);
          if (pObj2) {
            if (dCand === -1 && pObj2.period <= prevP && currDay !== -1) {
              // 요일 셀이 병합되어 빈칸일 때는 기존 요일 유지, 만약 요일 열이 아예 없으면 증가
              var hasAnyDayInCol = false;
              for (var rr = 0; rr < rows.length; rr++) {
                if (parseDayCell_(rows[rr][cD]) !== -1) {
                  hasAnyDayInCol = true;
                  break;
                }
              }
              if (!hasAnyDayInCol) currDay++;
            }
            if (currDay === -1) currDay = 0;
            prevP = pObj2.period;

            if (currDay >= 0 && currDay <= 4) {
              tempRowMap2[r3] = { dayIdx: currDay, period: pObj2.period };
              if (pObj2.time && !meta.periodTimes[pObj2.period - 1]) {
                meta.periodTimes[pObj2.period - 1] = pObj2.time;
              }
              if (pObj2.period > store.maxPeriod) store.maxPeriod = pObj2.period;
            }
          }
        }

        if (Object.keys(tempRowMap2).length >= 10) {
          rowMap = tempRowMap2;
          scheduleStartRow = minRow2;
          lastHeaderCol = cP;
          break;
        }
      }
    }
  }

  if (!rowMap || scheduleStartRow === 0) return false;

  // scheduleStartRow 위쪽의 헤더 행에서 각 열(c > lastHeaderCol)의 학급명 또는 교사명 파악
  var entityHeaderRow = scheduleStartRow - 1;
  var subHeaderRow = -1;
  if (scheduleStartRow >= 2) {
    // 윗행과 아랫행 중 학급/교사 이름이 더 많은 행을 메인 엔티티 행으로 선택
    var countR1 = countNonEmptyCols_(rows[scheduleStartRow - 1], lastHeaderCol + 1);
    var countR2 = countNonEmptyCols_(rows[scheduleStartRow - 2], lastHeaderCol + 1);
    if (countR2 >= countR1 && countR2 > 0) {
      entityHeaderRow = scheduleStartRow - 2;
      subHeaderRow = scheduleStartRow - 1;
    } else {
      entityHeaderRow = scheduleStartRow - 1;
      subHeaderRow = scheduleStartRow - 2;
    }
  }

  var numCols = rows[entityHeaderRow].length;
  for (var col = lastHeaderCol + 1; col < numCols; col++) {
    var rawHeader = String(rows[entityHeaderRow][col] || '').trim();
    var rawSub = subHeaderRow >= 0 ? String(rows[subHeaderRow][col] || '').trim() : '';
    if (!rawHeader) continue;

    var identity = parseSingleHeaderIdentity_(rawHeader, rawSub, role);
    if (!identity.key) continue;

    for (var rIdx in rowMap) {
      var rNum = parseInt(rIdx, 10);
      var slotInfo = rowMap[rIdx];
      var cellTxt = String(rows[rNum][col] || '').trim();

      //もし 다음 행이 rowMap에 없고(2행 병합 교시), 같은 교시 블록의 서브행이라면 합치기
      if (rNum + 1 < rows.length && !rowMap[rNum + 1]) {
        var nextDayCheck = parseDayCell_(rows[rNum + 1][0]);
        var nextPeriodCheck = parsePeriodCell_(rows[rNum + 1][lastHeaderCol]);
        if (nextDayCheck === -1 && !nextPeriodCheck) {
          var subCellTxt = String(rows[rNum + 1][col] || '').trim();
          if (subCellTxt) {
            cellTxt = cellTxt ? cellTxt + '\n' + subCellTxt : subCellTxt;
          }
        }
      }

      if (cellTxt) {
        assignSlotToStore_(identity, slotInfo.period - 1, slotInfo.dayIdx, cellTxt, role, store);
      }
    }
  }

  return true;
}

/**
 * [레이아웃 3] 5열 주간 시간표 블록형 파서 ('교시 | 월 | 화 | 수 | 목 | 금' 표가 1개 또는 여러 개 배치된 시트)
 */
function tryParseFiveDayBlocks_(rows, role, store, meta, sheetName) {
  var blocks = [];

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    var c = 0;
    while (c < row.length) {
      if (parseDayCell_(row[c]) === 0) {
        // 같은 행 우측 10칸 이내에서 화(1), 수(2), 목(3), 금(4) 탐색
        var dayCols = [c];
        var nextExpectedDay = 1;
        for (var scanC = c + 1; scanC < Math.min(row.length, c + 12) && nextExpectedDay <= 4; scanC++) {
          var dIdx = parseDayCell_(row[scanC]);
          if (dIdx === nextExpectedDay) {
            dayCols.push(scanC);
            nextExpectedDay++;
          } else if (dIdx === 0) {
            // 바로 다음 블록이 시작된 경우 중단
            break;
          }
        }

        if (dayCols.length === 5) {
          // 이 블록 바로 아래에 교시(1~7)가 세로로 나열되어 있는지 검증
          var periodCol = c - 1;
          var validPeriodsBelow = 0;
          for (var checkR = r + 1; checkR < Math.min(rows.length, r + 16); checkR++) {
            for (var pc = Math.max(0, c - 2); pc <= c - 1; pc++) {
              if (parsePeriodCell_(rows[checkR][pc])) {
                periodCol = pc;
                validPeriodsBelow++;
                break;
              }
            }
          }

          if (validPeriodsBelow >= 3) {
            blocks.push({
              headerRow: r,
              periodCol: periodCol,
              dayCols: dayCols
            });
            c = dayCols[4] + 1;
            continue;
          }
        }
      }
      c++;
    }
  }

  if (blocks.length === 0) return false;

  for (var b = 0; b < blocks.length; b++) {
    var blk = blocks[b];
    var minCol = Math.max(0, blk.periodCol);
    var maxCol = blk.dayCols[4];

    // 블록 상단(headerRow - 4 ~ headerRow)에서 학급명 / 담임 / 교사명 추출
    var blockTexts = [];
    for (var tr = Math.max(0, blk.headerRow - 4); tr <= blk.headerRow; tr++) {
      for (var tc = minCol; tc <= maxCol; tc++) {
        if (tr === blk.headerRow && tc >= blk.dayCols[0]) continue;
        var tVal = String(rows[tr][tc] || '').trim();
        if (tVal) blockTexts.push(tVal);
      }
    }

    var identity = extractBlockIdentity_(blockTexts.join(' | '), role, sheetName, b + 1, blocks.length);

    // 블록 하단 행들에서 1~N교시 파싱
    var lastPeriodIdx = -1;
    var lastPeriodRow = -1;
    for (var pr = blk.headerRow + 1; pr < Math.min(rows.length, blk.headerRow + 24); pr++) {
      // 다음 블록의 요일 헤더를 만나면 중단
      if (parseDayCell_(rows[pr][blk.dayCols[0]]) === 0 && parseDayCell_(rows[pr][blk.dayCols[1]]) === 1) {
        break;
      }

      var rawPeriodCell = blk.periodCol >= 0 ? String(rows[pr][blk.periodCol] || '').trim() : '';
      var pInfo = parsePeriodCell_(rawPeriodCell);

      if (pInfo) {
        lastPeriodIdx = pInfo.period - 1;
        lastPeriodRow = pr;
        if (pInfo.period > store.maxPeriod) store.maxPeriod = pInfo.period;
        if (pInfo.time && !meta.periodTimes[lastPeriodIdx]) {
          meta.periodTimes[lastPeriodIdx] = pInfo.time;
        }

        for (var d = 0; d < 5; d++) {
          var cellVal = String(rows[pr][blk.dayCols[d]] || '').trim();
          if (cellVal) {
            assignSlotToStore_(identity, lastPeriodIdx, d, cellVal, role, store);
          }
        }
      } else if (lastPeriodIdx !== -1 && pr <= lastPeriodRow + 2) {
        // 교시 셀이 시각(예: 08:20)이거나 병합된 빈 셀인 경우: 시간 추출 및 2~3행 구조 서브 텍스트 병합
        var timeMatch = rawPeriodCell.match(/(\d{1,2}:\d{2})/);
        if (timeMatch && !meta.periodTimes[lastPeriodIdx]) {
          meta.periodTimes[lastPeriodIdx] = timeMatch[1];
        }
        var targetRole = role === 'class' || identity.isClassInWeekly ? 'class' : 'teacher';
        var targetEntity =
          targetRole === 'class' ? store.classes[identity.key] : store.teachers[identity.key];
        if (targetEntity) {
          for (var d2 = 0; d2 < 5; d2++) {
            var subText = String(rows[pr][blk.dayCols[d2]] || '').trim();
            if (subText) {
              appendSecondLineToSlot_(targetEntity, lastPeriodIdx, d2, subText, targetRole, store);
            }
          }
        }
      } else if (lastPeriodIdx !== -1 && pr > lastPeriodRow + 2) {
        lastPeriodIdx = -1;
      }
    }
  }

  return true;
}

/**
 * [레이아웃 4] 정규화된 행 목록형 파서 (요일 | 교시 | 학급 | 과목 | 교사)
 */
function tryParseFlatRowTable_(rows, role, store, meta) {
  var headerRowIdx = -1;
  var colIdx = null;

  for (var r = 0; r < Math.min(10, rows.length); r++) {
    var headers = rows[r].map(function (h) {
      return String(h || '').replace(/\s+/g, '');
    });
    var dCol = findColIndex_(headers, ['요일', 'day']);
    var pCol = findColIndex_(headers, ['교시', '교시번호', 'period']);
    if (dCol !== -1 && pCol !== -1) {
      headerRowIdx = r;
      colIdx = {
        day: dCol,
        period: pCol,
        classKey: findColIndex_(headers, ['학급', '학년반', '반', '교실']),
        grade: findColIndex_(headers, ['학년']),
        classNo: findColIndex_(headers, ['반번호', '분반']),
        subject: findColIndex_(headers, ['과목', '교과', '과목명']),
        teacher: findColIndex_(headers, ['교사', '담당교사', '선생님', '성명', '이름']),
        homeroom: findColIndex_(headers, ['담임', '담임교사']),
        room: findColIndex_(headers, ['장소', '특별실', '강의실']),
        moving: findColIndex_(headers, ['이동수업', '이동', '구분']),
        status: findColIndex_(headers, ['상태', '비고', '보강', '변경'])
      };
      break;
    }
  }

  if (headerRowIdx === -1 || !colIdx) return false;

  for (var i = headerRowIdx + 1; i < rows.length; i++) {
    var row = rows[i];
    var dIdx = parseDayCell_(row[colIdx.day]);
    var pObj = parsePeriodCell_(row[colIdx.period]);
    if (dIdx === -1 || !pObj) continue;

    if (pObj.period > store.maxPeriod) store.maxPeriod = pObj.period;
    var pIdx = pObj.period - 1;

    var cKey = '';
    if (colIdx.classKey !== -1 && row[colIdx.classKey]) {
      cKey = normalizeClassKey_(row[colIdx.classKey]);
    } else if (colIdx.grade !== -1 && colIdx.classNo !== -1 && row[colIdx.grade] && row[colIdx.classNo]) {
      cKey = normalizeClassKey_(row[colIdx.grade] + '-' + row[colIdx.classNo]);
    }

    var subj = colIdx.subject !== -1 ? String(row[colIdx.subject] || '').trim() : '';
    var tName = colIdx.teacher !== -1 ? String(row[colIdx.teacher] || '').trim() : '';
    var hrName = colIdx.homeroom !== -1 ? String(row[colIdx.homeroom] || '').trim() : '';
    var room = colIdx.room !== -1 ? String(row[colIdx.room] || '').trim() : '';
    var movRaw = colIdx.moving !== -1 ? String(row[colIdx.moving] || '').trim().toUpperCase() : '';
    var stRaw = colIdx.status !== -1 ? String(row[colIdx.status] || '').trim() : '';

    var isMov = movRaw === 'Y' || movRaw === 'TRUE' || movRaw.indexOf('이동') !== -1 || movRaw.indexOf('선택') !== -1;
    var isCc = isChangcheSubject_(subj);

    var tCleaned = cleanTeacherIdentity_(tName, '');
    tName = tCleaned.name;
    var hrCleaned = cleanTeacherIdentity_(hrName, '');
    hrName = hrCleaned.name;

    if (cKey) {
      var cEntity = ensureClassEntity_(store, cKey, hrName);
      if (subj || tName) {
        if (tName) store.hasTeacherInClassCells = true;
        cEntity.grid[pIdx][dIdx] = {
          s: subj || cKey,
          t: tName,
          c: cKey,
          r: room,
          m: isMov ? 1 : 0,
          cc: isCc ? 1 : 0,
          st: stRaw
        };
      }
    }

    if (tName && tName !== '-' && tName !== '—') {
      var tEntity = ensureTeacherEntity_(store, tName, subj || tCleaned.subject, '');
      if (tEntity && (subj || cKey)) {
        tEntity.grid[pIdx][dIdx] = {
          s: subj,
          t: tEntity.key,
          c: cKey,
          r: room,
          m: isMov ? 1 : 0,
          cc: isCc ? 1 : 0,
          st: stRaw
        };
      }
    }
  }

  return true;
}

/**
 * 요일 셀 판별 ('월', '월요일' -> 0 .. '금', '금요일' -> 4)
 */
function parseDayCell_(val) {
  var s = String(val || '').trim();
  if (!s) return -1;
  var m = s.match(/^([월화수목금])(?:요일)?$/);
  if (m) {
    return ['월', '화', '수', '목', '금'].indexOf(m[1]);
  }
  return -1;
}

/**
 * 교시 셀 판별 ('1', '1교시', '1교시(08:20)', '1\n08:20' -> { period: 1, time: '08:20' })
 */
function parsePeriodCell_(val) {
  var s = String(val || '').trim();
  if (!s) return null;

  var circled = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  for (var c = 0; c < circled.length; c++) {
    if (s.indexOf(circled[c]) !== -1) {
      var tMatch0 = s.match(/(\d{1,2}:\d{2})/);
      return { period: c + 1, time: tMatch0 ? tMatch0[1] : '' };
    }
  }

  var timeMatch = s.match(/(\d{1,2}:\d{2})/);
  var clean = s.replace(/\(\s*\d{1,2}:\d{2}[^)]*\)/g, '').replace(/\d{1,2}:\d{2}(\s*~\s*\d{1,2}:\d{2})?/g, '').trim();

  var m = clean.match(/^(?:제\s*)?([1-9]|10)\s*(?:교시)?$/);
  if (m) {
    return {
      period: parseInt(m[1], 10),
      time: timeMatch ? timeMatch[1] : ''
    };
  }
  return null;
}

/**
 * 결합된 요일+교시 셀 판별 ('월1', '월-1', '월(1)', '월 1교시' -> { dayIdx: 0, period: 1 })
 */
function parseCombinedDayPeriod_(val) {
  var s = String(val || '').trim();
  if (!s) return null;
  var m = s.match(/^([월화수목금])(?:요일)?\s*[-_(\s/]*([1-9]|10)\s*(?:교시)?\)?$/);
  if (m) {
    var dIdx = ['월', '화', '수', '목', '금'].indexOf(m[1]);
    var pNum = parseInt(m[2], 10);
    if (dIdx !== -1 && pNum >= 1 && pNum <= 10) {
      return { dayIdx: dIdx, period: pNum };
    }
  }
  return null;
}

/**
 * 가로 매트릭스의 좌측 열들에서 행의 대표 식별자(학급 또는 교사) 추출
 */
function extractRowIdentity_(row, firstScheduleCol, leftHeaders, role) {
  var gradeVal = '';
  var classNoVal = '';
  var classKey = '';
  var teacherName = '';
  var subjectName = '';
  var homeroomName = '';
  var unknownTokens = [];

  for (var c = 0; c < Math.min(firstScheduleCol, row.length); c++) {
    var val = String(row[c] || '').trim();
    if (!val || val === '-' || val === '—') continue;
    var h = leftHeaders[c] || '';

    if (h.indexOf('학년') !== -1 && h.indexOf('반') === -1 && /^\d+$/.test(val)) {
      gradeVal = val;
      continue;
    }
    if ((h === '반' || h.indexOf('반번호') !== -1) && /^\d+$/.test(val)) {
      classNoVal = val;
      continue;
    }
    if (h.indexOf('학급') !== -1 || h.indexOf('학년반') !== -1) {
      var ck = normalizeClassKey_(val);
      if (ck) classKey = ck;
      continue;
    }
    if (h.indexOf('담임') !== -1) {
      homeroomName = val;
      continue;
    }
    if (h.indexOf('교사') !== -1 || h.indexOf('성명') !== -1 || h.indexOf('이름') !== -1 || h.indexOf('선생님') !== -1) {
      teacherName = val;
      continue;
    }
    if (h.indexOf('과목') !== -1 || h.indexOf('교과') !== -1 || h.indexOf('전공') !== -1) {
      subjectName = val;
      continue;
    }

    // 헤더명이 불분명할 때 값 패턴으로 추론
    var maybeClass = tryExtractClassKeyStrict_(val);
    if (maybeClass) {
      if (!classKey) classKey = maybeClass;
    } else if (!/^\d+$/.test(val)) {
      unknownTokens.push(val);
    }
  }

  if (!classKey && gradeVal && classNoVal) {
    classKey = gradeVal + '-' + classNoVal;
  }

  if (role === 'class') {
    if (!classKey && unknownTokens.length > 0) {
      classKey = normalizeClassKey_(unknownTokens[0]);
    }
    if (!homeroomName && unknownTokens.length > 0) {
      homeroomName = unknownTokens[unknownTokens.length - 1];
      if (homeroomName === classKey) homeroomName = '';
    }
    var cleanHr = cleanTeacherIdentity_(homeroomName, '');
    return {
      key: classKey,
      homeroom: cleanHr.name,
      subject: subjectName
    };
  } else {
    // role === 'teacher'
    if (!teacherName && unknownTokens.length > 0) {
      // 보통 [교사명] 또는 [과목, 교사명] 또는 [교사명, 과목]
      if (unknownTokens.length === 1) {
        teacherName = unknownTokens[0];
      } else {
        teacherName = unknownTokens[0];
        if (!subjectName) subjectName = unknownTokens[1];
      }
    }
    var cleanedT = cleanTeacherIdentity_(teacherName, subjectName);
    // 연번이나 요약 행('합계', '계', '평균', '교시') 제외
    if (isIgnoredEntityName_(cleanedT.name)) {
      return { key: '' };
    }
    return {
      key: cleanedT.name,
      subject: cleanedT.subject,
      homeroomClass: classKey
    };
  }
}

/**
 * 세로 매트릭스의 단일 열 헤더에서 학급 또는 교사 식별자 추출
 */
function parseSingleHeaderIdentity_(rawHeader, rawSub, role) {
  var h = String(rawHeader || '').trim();
  var sub = String(rawSub || '').trim();
  if (isIgnoredEntityName_(h)) return { key: '' };

  if (role === 'class') {
    var ck = tryExtractClassKeyStrict_(h) || normalizeClassKey_(h);
    var rawHr = sub && !tryExtractClassKeyStrict_(sub) ? sub : '';
    return {
      key: ck,
      homeroom: cleanTeacherIdentity_(rawHr, '').name
    };
  } else {
    var ckInTeacherSheet = tryExtractClassKeyStrict_(h);
    if (ckInTeacherSheet && !sub) {
      return { key: ckInTeacherSheet, isClassInWeekly: true };
    }
    var cleanedH = cleanTeacherIdentity_(h, sub);
    if (isIgnoredEntityName_(cleanedH.name)) return { key: '' };
    return {
      key: cleanedH.name,
      subject: cleanedH.subject
    };
  }
}

/**
 * 5열 블록 상단 텍스트에서 학급 또는 교사 식별자 추출
 */
function extractBlockIdentity_(headerBlob, role, sheetName, blockNum, totalBlocks) {
  var blob = String(headerBlob || '').trim();

  var homeroomMatch = blob.match(/담임\s*[:|｜\-]?\s*([가-힣A-Za-z*]{2,10})/);
  var teacherMatch = blob.match(/(?:교사|선생님|성명)\s*[:|｜\-]?\s*([가-힣A-Za-z*]{2,10}(?:\([^)]+\))?)/);
  var classKey = tryExtractClassKeyFromText_(blob);

  if (role === 'class') {
    var key = classKey || (totalBlocks === 1 ? sheetName : '학급-' + blockNum);
    return {
      key: key,
      homeroom: homeroomMatch ? cleanTeacherIdentity_(homeroomMatch[1], '').name : ''
    };
  } else {
    var tKey = teacherMatch ? teacherMatch[1].trim() : '';
    if (!tKey && homeroomMatch) tKey = homeroomMatch[1].trim();
    if (!tKey && classKey) {
      return {
        key: classKey,
        isClassInWeekly: true,
        homeroom: homeroomMatch ? cleanTeacherIdentity_(homeroomMatch[1], '').name : ''
      };
    }
    if (!tKey) {
      // 텍스트 중 '시간표', '학년도', '학기'가 아닌 짧은 한글 이름 탐색
      var tokens = blob.split(/[|｜\s/]+/);
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i].trim();
        var tkClean = cleanTeacherIdentity_(tk, '').name;
        if (/^[가-힣]{2,4}\*?$/.test(tkClean) && !isIgnoredEntityName_(tkClean)) {
          tKey = tk;
          break;
        }
      }
    }
    var cleanedBlockT = cleanTeacherIdentity_(tKey, '');
    return {
      key: cleanedBlockT.name || (totalBlocks === 1 ? '주간 전체 시간표' : '교사-' + blockNum),
      subject: cleanedBlockT.subject,
      isMasterWeekly: !cleanedBlockT.name && totalBlocks === 1
    };
  }
}

/**
 * 가로 매트릭스에서 엔티티 및 해당 행의 모든 교시 슬롯 등록
 */
function registerEntityAndRowSlots_(identity, row, colMap, role, store) {
  var entity = null;
  if (role === 'class') {
    entity = ensureClassEntity_(store, identity.key, identity.homeroom);
  } else {
    entity = ensureTeacherEntity_(store, identity.key, identity.subject, identity.homeroomClass);
  }

  for (var colStr in colMap) {
    var col = parseInt(colStr, 10);
    var slot = colMap[colStr];
    var cellTxt = String(row[col] || '').trim();
    if (!cellTxt) continue;
    assignSlotToStore_(identity, slot.period - 1, slot.dayIdx, cellTxt, role, store);
  }

  return entity;
}

/**
 * 단일 셀 문자열을 파싱하여 store.classes 또는 store.teachers의 (pIdx, dayIdx)에 배정
 */
function assignSlotToStore_(identity, pIdx, dayIdx, rawText, role, store) {
  var clean = String(rawText || '').trim();
  if (!clean || clean === '-' || clean === '—' || clean === '공강') return;

  if (role === 'class' || identity.isClassInWeekly) {
    var cEntity = ensureClassEntity_(store, identity.key, identity.homeroom || '');
    var parsedC = parseClassCellContent_(clean);
    if (!parsedC.s) return;

    if (parsedC.t) store.hasTeacherInClassCells = true;
    ensureGridRowSize_(cEntity.grid, pIdx + 1);
    cEntity.grid[pIdx][dayIdx] = {
      s: parsedC.s,
      t: parsedC.t,
      c: identity.key,
      r: parsedC.r,
      m: parsedC.m,
      cc: parsedC.cc,
      st: parsedC.st,
      eg: parsedC.eg || '',
      _raw: clean
    };

    // 셀 안에 교사 이름이 함께 적혀 있다면 교사 시간표에도 즉시 반영
    if (parsedC.t) {
      var subjForT = !isChangcheSubject_(parsedC.s) ? parsedC.s.replace(/\s*\(.*\)/, '') : '';
      var tEnt = ensureTeacherEntity_(store, parsedC.t, subjForT, '');
      if (tEnt) {
        cEntity.grid[pIdx][dayIdx].t = tEnt.key;
        ensureGridRowSize_(tEnt.grid, pIdx + 1);
        if (!tEnt.grid[pIdx][dayIdx]) {
          tEnt.grid[pIdx][dayIdx] = {
            s: parsedC.s,
            t: tEnt.key,
            c: identity.key,
            r: parsedC.r,
            m: parsedC.m,
            cc: parsedC.cc,
            st: parsedC.st,
            eg: parsedC.eg || ''
          };
        }
      }
    }
  } else if (identity.isMasterWeekly) {
    // 주간시간표가 단일 통합 표('주간 전체 시간표')인 경우: 학급 뷰와 교사 뷰 양쪽에 모두 등록
    var masterClass = ensureClassEntity_(store, identity.key, '');
    var parsedM = parseClassCellContent_(clean);
    if (!parsedM.s) return;

    if (parsedM.t) store.hasTeacherInClassCells = true;
    ensureGridRowSize_(masterClass.grid, pIdx + 1);
    masterClass.grid[pIdx][dayIdx] = {
      s: parsedM.s,
      t: parsedM.t,
      c: identity.key,
      r: parsedM.r,
      m: parsedM.m,
      cc: parsedM.cc,
      st: parsedM.st,
      eg: parsedM.eg || '',
      _raw: clean
    };

    if (parsedM.t) {
      var subjForT2 = !isChangcheSubject_(parsedM.s) ? parsedM.s.replace(/\s*\(.*\)/, '') : '';
      var tEnt2 = ensureTeacherEntity_(store, parsedM.t, subjForT2, '');
      if (tEnt2) {
        masterClass.grid[pIdx][dayIdx].t = tEnt2.key;
        ensureGridRowSize_(tEnt2.grid, pIdx + 1);
        tEnt2.grid[pIdx][dayIdx] = {
          s: parsedM.s,
          t: tEnt2.key,
          c: parsedM.c || '',
          r: parsedM.r,
          m: parsedM.m,
          cc: parsedM.cc,
          st: parsedM.st,
          eg: parsedM.eg || ''
        };
      }
    }
  } else {
    // 교사별 시간표 슬롯
    var tEntity = ensureTeacherEntity_(store, identity.key, identity.subject || '', identity.homeroomClass || '');
    if (!tEntity) return;
    tEntity._currentBlockSubject = identity.subject || '';
    var parsedT = parseTeacherCellContent_(clean, identity.subject || '');
    if (!parsedT.s && !parsedT.c) return;

    ensureGridRowSize_(tEntity.grid, pIdx + 1);
    tEntity.grid[pIdx][dayIdx] = {
      s: parsedT.s || identity.subject || tEntity.subjectMain || parsedT.c,
      t: tEntity.key,
      c: parsedT.c,
      r: parsedT.r,
      m: parsedT.m,
      cc: parsedT.cc,
      st: parsedT.st,
      _raw: clean
    };
  }
}

/**
 * 2~3행 병합 구조에서 후속 행의 텍스트(교사명 또는 과목명)를 직전 슬롯에 결합합니다.
 */
function appendSecondLineToSlot_(entity, pIdx, dayIdx, secondLineText, role, store) {
  if (!entity) return;
  ensureGridRowSize_(entity.grid, pIdx + 1);
  var existing = entity.grid[pIdx][dayIdx];
  var prevRaw = existing ? (existing._raw || existing.c || existing.s || '') : '';
  var combinedRaw = prevRaw ? prevRaw + '\n' + secondLineText : secondLineText;

  if (role === 'class') {
    var parsed = parseClassCellContent_(combinedRaw);
    if (parsed.t) store.hasTeacherInClassCells = true;
    entity.grid[pIdx][dayIdx] = {
      s: parsed.s,
      t: parsed.t,
      c: entity.key,
      r: parsed.r,
      m: parsed.m,
      cc: parsed.cc,
      st: parsed.st,
      eg: parsed.eg || '',
      _raw: combinedRaw
    };
    if (parsed.t) {
      var subjForT3 = !isChangcheSubject_(parsed.s) ? parsed.s.replace(/\s*\(.*\)/, '') : '';
      var tEnt = ensureTeacherEntity_(store, parsed.t, subjForT3, '');
      if (tEnt) {
        entity.grid[pIdx][dayIdx].t = tEnt.key;
        ensureGridRowSize_(tEnt.grid, pIdx + 1);
        if (!tEnt.grid[pIdx][dayIdx]) {
          tEnt.grid[pIdx][dayIdx] = {
            s: parsed.s,
            t: tEnt.key,
            c: entity.key,
            r: parsed.r,
            m: parsed.m,
            cc: parsed.cc,
            st: parsed.st,
            eg: parsed.eg || ''
          };
        }
      }
    }
  } else {
    var blockSubj = entity._currentBlockSubject || '';
    var parsedT = parseTeacherCellContent_(combinedRaw, blockSubj);
    entity.grid[pIdx][dayIdx] = {
      s: parsedT.s || blockSubj || entity.subjectMain || parsedT.c,
      t: entity.key,
      c: parsedT.c,
      r: parsedT.r,
      m: parsedT.m,
      cc: parsedT.cc,
      st: parsedT.st,
      _raw: combinedRaw
    };
  }
}

/**
 * 학급 시간표 셀 텍스트 파싱 (과목명, 담당교사, 부가 활동명, 선택과목 그룹 분리)
 */
function parseClassCellContent_(rawText) {
  var text = String(rawText || '').trim();
  var status = '';
  var isMoving = 0;

  var stMatch = text.match(/^\[(보강|교체|이동)\]\s*/);
  if (stMatch) {
    status = stMatch[1];
    text = text.slice(stMatch[0].length).trim();
  }
  if (text.indexOf('[이동수업]') !== -1) {
    isMoving = 1;
    text = text.replace(/\[이동수업\]/g, '').trim();
  }

  var lines = text
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);

  var subj = '';
  var teacher = '';
  var room = '';
  var egHint = '';

  if (lines.length >= 3) {
    var line1Hint = extractElectiveGroupHint_(lines[0]);
    if (line1Hint) {
      egHint = line1Hint;
      var stripped0 = stripElectiveGroupPrefix_(lines[0]);
      subj = stripped0 ? stripped0 + ' ' + lines[1] : lines[1];
      teacher = lines[2].replace(/^[(\[]|[)\]]$/g, '').trim();
      if (lines[3]) room = lines[3];
    } else if (/^\([^)]+\)$/.test(lines[1]) && isActivityBracket_(lines[1])) {
      subj = lines[0] + ' ' + lines[1];
      teacher = lines[2].replace(/^[(\[]|[)\]]$/g, '').trim();
      if (lines[3]) room = lines[3];
    } else {
      subj = lines[0];
      teacher = lines[1].replace(/^[(\[]|[)\]]$/g, '').trim();
      room = lines[2];
    }
  } else if (lines.length === 2) {
    var l0Hint = extractElectiveGroupHint_(lines[0]);
    var line2 = lines[1];
    if (l0Hint && !stripElectiveGroupPrefix_(lines[0])) {
      egHint = l0Hint;
      var cleanedL2 = line2.replace(/^[(\[]|[)\]]$/g, '').trim();
      if (isLikelySubjectToken_(cleanedL2)) {
        subj = cleanedL2;
      } else {
        subj = lines[0];
        teacher = cleanedL2;
      }
    } else if (/^\([^)]+\)$/.test(line2) && isActivityBracket_(line2)) {
      subj = lines[0] + ' ' + line2;
    } else {
      subj = lines[0];
      teacher = line2.replace(/^[(\[]|[)\]]$/g, '').trim();
    }
  } else if (lines.length === 1) {
    var single = lines[0];
    var mBracket = single.match(/^(.*?)\s*\(([^)]+)\)$/);
    if (mBracket) {
      var inner = mBracket[2].trim();
      if (isActivityBracket_('(' + inner + ')')) {
        subj = mBracket[1].trim() + ' (' + inner + ')';
      } else {
        subj = mBracket[1].trim();
        teacher = inner;
      }
    } else if (single.indexOf('/') !== -1) {
      var slashParts = single.split('/');
      subj = slashParts[0].trim();
      teacher = slashParts[1].trim();
    } else {
      subj = single;
    }
  }

  if (!egHint) {
    egHint = extractElectiveGroupHint_(subj);
  }

  if (teacher) {
    var cleanedCellT = cleanTeacherIdentity_(teacher, '');
    teacher = cleanedCellT.name;
  }

  var isCc = isChangcheSubject_(subj) ? 1 : 0;
  return {
    s: subj,
    t: teacher,
    c: '',
    r: room,
    m: isMoving,
    cc: isCc,
    st: status,
    eg: egHint
  };
}

/**
 * 교사 시간표 셀 텍스트 파싱 (예: "2-3\n국어", "203\n국어", "국어(2-3)", "2-3")
 */
function parseTeacherCellContent_(rawText, defaultSubject) {
  var text = String(rawText || '').trim();
  var status = '';
  var isMoving = 0;

  var stMatch = text.match(/^\[(보강|교체|이동)\]\s*/);
  if (stMatch) {
    status = stMatch[1];
    text = text.slice(stMatch[0].length).trim();
  }

  var lines = text
    .split(/\r?\n/)
    .map(function (l) {
      return l.trim();
    })
    .filter(Boolean);

  var classKey = '';
  var subj = '';
  var room = '';

  if (lines.length >= 2) {
    var c1 = tryExtractClassKeyStrict_(lines[0]);
    var c2 = tryExtractClassKeyStrict_(lines[1]);
    if (c1) {
      classKey = c1;
      subj = lines[1];
    } else if (c2) {
      subj = lines[0];
      classKey = c2;
    } else {
      subj = lines[0];
      room = lines[1];
    }
  } else if (lines.length === 1) {
    var s = lines[0];
    var cOnly = tryExtractClassKeyStrict_(s);
    if (cOnly) {
      classKey = cOnly;
      subj = defaultSubject || '';
    } else {
      // "2-3(국어)", "203 국어", "국어(2-3)", "국어 2-3"
      var m1 = s.match(/^([^\s(]+)\s*\(([^)]+)\)$/);
      if (m1) {
        var leftC = tryExtractClassKeyStrict_(m1[1]);
        var rightC = tryExtractClassKeyStrict_(m1[2]);
        if (leftC) {
          classKey = leftC;
          subj = m1[2].trim();
        } else if (rightC) {
          subj = m1[1].trim();
          classKey = rightC;
        } else {
          subj = s;
        }
      } else {
        var slashOrUnder = s.split(/[/_]/);
        if (slashOrUnder.length === 2) {
          var sc0 = tryExtractClassKeyStrict_(slashOrUnder[0].trim());
          var sc1 = tryExtractClassKeyStrict_(slashOrUnder[1].trim());
          if (sc0) {
            classKey = sc0;
            subj = slashOrUnder[1].trim();
          } else if (sc1) {
            subj = slashOrUnder[0].trim();
            classKey = sc1;
          }
        }
        if (!classKey && !subj) {
          var mCompact = s.match(/^([1-6]\s*-\s*(?:[1-9]|1\d|2[0-5])|[1-6]0[1-9])\s*([가-힣A-Za-z].*)$/);
          if (mCompact) {
            var cComp = tryExtractClassKeyStrict_(mCompact[1]);
            if (cComp) {
              classKey = cComp;
              subj = mCompact[2].trim();
            }
          }
        }
        if (!classKey && !subj) {
          var tokens = s.split(/\s+/);
          if (tokens.length >= 2) {
            var tc0 = tryExtractClassKeyStrict_(tokens[0]);
            var tc1 = tryExtractClassKeyStrict_(tokens[tokens.length - 1]);
            if (tc0) {
              classKey = tc0;
              subj = tokens.slice(1).join(' ');
            } else if (tc1) {
              classKey = tc1;
              subj = tokens.slice(0, tokens.length - 1).join(' ');
            } else {
              subj = s;
            }
          } else {
            subj = s;
          }
        }
      }
    }
  }

  var isCc = isChangcheSubject_(subj) ? 1 : 0;
  return {
    s: subj,
    c: classKey,
    r: room,
    m: isMoving,
    cc: isCc,
    st: status
  };
}

/**
 * 주간시간표(teachers)와 학급시간표(classes) 데이터를 상호 교차 보완합니다.
 */
function crossEnrichTimetables_(store) {
  var maxP = store.maxPeriod;

  // 1. 교사 시간표(teachers) -> 학급 시간표(classes) 보완
  Object.keys(store.teachers).forEach(function (tKey) {
    var tObj = store.teachers[tKey];
    ensureGridRowSize_(tObj.grid, maxP);

    for (var p = 0; p < maxP; p++) {
      for (var d = 0; d < 5; d++) {
        var tSlot = tObj.grid[p][d];
        if (!tSlot || !tSlot.c) continue;

        var cObj = ensureClassEntity_(store, tSlot.c, '');
        ensureGridRowSize_(cObj.grid, maxP);
        var cSlot = cObj.grid[p][d];

        if (!cSlot) {
          cObj.grid[p][d] = {
            s: tSlot.s || tObj.subjectMain || '',
            t: tObj.name,
            c: tSlot.c,
            r: tSlot.r || '',
            m: tSlot.m || 0,
            cc: tSlot.cc || 0,
            st: tSlot.st || ''
          };
          store.hasTeacherInClassCells = true;
        } else {
          if (!cSlot.t) {
            cSlot.t = tObj.name;
          }
          if (
            (!tSlot.s ||
              tSlot.s === tSlot.c ||
              (tSlot.s === tObj.subjectMain && cSlot.s && cSlot.s !== tObj.subjectMain)) &&
            cSlot.s
          ) {
            tSlot.s = cSlot.s;
          }
          if (!tObj.subjectMain && cSlot.s && !isChangcheSubject_(cSlot.s)) {
            tObj.subjectMain = cSlot.s.replace(/\s*\(.*\)/, '');
          }
        }
      }
    }
  });

  // 2. 학급 시간표(classes) -> 교사 시간표(teachers) 보완
  Object.keys(store.classes).forEach(function (cKey) {
    var cObj = store.classes[cKey];
    ensureGridRowSize_(cObj.grid, maxP);

    if (cObj.homeroom && store.teachers[cObj.homeroom]) {
      store.teachers[cObj.homeroom].homeroomOf = cObj.label;
    }

    for (var p = 0; p < maxP; p++) {
      for (var d = 0; d < 5; d++) {
        var cSlot = cObj.grid[p][d];
        if (!cSlot || !cSlot.t) continue;

        var cleanSubj = !isChangcheSubject_(cSlot.s) ? cSlot.s.replace(/\s*\(.*\)/, '') : '';
        var tObj2 = ensureTeacherEntity_(store, cSlot.t, cleanSubj, '');
        if (!tObj2) continue;
        cSlot.t = tObj2.key;
        ensureGridRowSize_(tObj2.grid, maxP);
        if (!tObj2.grid[p][d]) {
          tObj2.grid[p][d] = {
            s: cSlot.s,
            t: tObj2.key,
            c: cKey,
            r: cSlot.r || '',
            m: cSlot.m || 0,
            cc: cSlot.cc || 0,
            st: cSlot.st || '',
            eg: cSlot.eg || ''
          };
        } else if (
          tObj2.grid[p][d].c === cKey &&
          cSlot.s &&
          (!tObj2.grid[p][d].s ||
            tObj2.grid[p][d].s === cKey ||
            (tObj2.grid[p][d].s === tObj2.subjectMain && cSlot.s !== tObj2.subjectMain))
        ) {
          tObj2.grid[p][d].s = cSlot.s;
        }
      }
    }
  });
}

/**
 * 교사 성명 정규화: '김동진(15)', '박수빈(04)' 등 괄호 안 시수(숫자)를 제거하고,
 * '김동진(D_영문)'처럼 괄호 안에 과목명이 있는 경우 성명과 과목명을 분리하여
 * 동일 교사가 항상 1개의 고유 키('김동진')로 통합되도록 보장합니다.
 */
function cleanTeacherIdentity_(rawName, rawSubject) {
  var raw = String(rawName || '').trim();
  var subj = String(rawSubject || '').trim();

  if (/^\d+\s*(?:시간|시수|h)?$/i.test(subj)) {
    subj = '';
  }

  if (!raw || raw === '-' || raw === '—') {
    return { name: '', subject: subj };
  }

  if (raw.indexOf('\n') !== -1) {
    var lines = raw
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);
    raw = lines[0] || '';
    if (lines[1] && !/^\d+\s*(?:시간|시수|h)?$/i.test(lines[1]) && !subj) {
      subj = lines[1].replace(/^[(\[]|[)\]]$/g, '').trim();
    }
  }

  var bracketRegex = /[(\[]([^)\]]+)[)\]]/g;
  var match;
  while ((match = bracketRegex.exec(raw)) !== null) {
    var inner = String(match[1] || '').trim();
    if (!inner) continue;
    if (!/^\d+\s*(?:시간|시수|h)?$/i.test(inner) && !subj) {
      subj = inner;
    }
  }

  var cleanName = raw
    .replace(/[(\[][^)\]]*[)\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    name: cleanName,
    subject: subj
  };
}

function ensureClassEntity_(store, classKey, homeroom) {
  var cleanHr = cleanTeacherIdentity_(homeroom, '').name;
  if (!store.classes[classKey]) {
    var parts = classKey.split('-');
    var isNumericPair = parts.length === 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]);
    var gNum = isNumericPair ? parseInt(parts[0], 10) : 99;
    var cNum = isNumericPair ? parseInt(parts[1], 10) : 99;
    var defaultRoom = '';
    if (gNum === 2 && cNum >= 1 && cNum <= 9) {
      defaultRoom = '30' + cNum + '호';
    } else if (gNum === 3 && cNum >= 1 && cNum <= 9) {
      defaultRoom = '40' + cNum + '호';
    }
    store.classes[classKey] = {
      key: classKey,
      label: isNumericPair ? parts[0] + '학년 ' + parts[1] + '반' : classKey,
      grade: gNum,
      classNo: cNum,
      room: defaultRoom,
      homeroom: cleanHr || '',
      grid: createEmptyGrid_(store.maxPeriod, 5)
    };
  } else if (cleanHr && !store.classes[classKey].homeroom) {
    store.classes[classKey].homeroom = cleanHr;
  }
  return store.classes[classKey];
}

function ensureTeacherEntity_(store, teacherName, subjectMain, homeroomClass) {
  var cleaned = cleanTeacherIdentity_(teacherName, subjectMain);
  var key = cleaned.name;
  var subj = cleaned.subject;
  if (!key) return null;

  if (!store.teachers[key]) {
    store.teachers[key] = {
      key: key,
      name: key,
      subjectMain: subj || '',
      homeroomOf: homeroomClass || '',
      grid: createEmptyGrid_(store.maxPeriod, 5)
    };
  } else {
    if (subj && !store.teachers[key].subjectMain) {
      store.teachers[key].subjectMain = subj;
    }
    if (homeroomClass && !store.teachers[key].homeroomOf) {
      store.teachers[key].homeroomOf = homeroomClass;
    }
  }
  return store.teachers[key];
}

function ensureGridRowSize_(grid, requiredRows) {
  while (grid.length < requiredRows) {
    grid.push([null, null, null, null, null]);
  }
}

/**
 * 엄격한 학급 키 추출 ('1-1', '1학년 1반', '101'~'609', '1월 1일')
 * - 3자리 숫자의 경우 211(211호), 315(315호), 416(416호) 등 특별실 호수가
 *   '2-11', '3-15', '4-16' 학급으로 오인식되지 않도록 '01'~'09'반만 허용합니다.
 */
function tryExtractClassKeyStrict_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';

  // "1학년 3반", "제 2 학년 3 반", "2-3", "2-3반"
  var m1 = s.match(/^(?:제\s*)?([1-6])\s*(?:학년|[-.])\s*([1-9]|1\d|2[0-5])\s*(?:반)?$/);
  if (m1) return parseInt(m1[1], 10) + '-' + parseInt(m1[2], 10);

  // "101", "203", "309반" (3자리 학년반 코드: 01~09반만 인정, 211/315/416 등 호실 오탐 방지)
  var m2 = s.match(/^([1-6])(0[1-9])\s*(?:반)?$/);
  if (m2) return parseInt(m2[1], 10) + '-' + parseInt(m2[2], 10);

  // 구글 시트가 '1-1'을 '1월 1일'로 자동 변환한 경우 복원
  var mDate = s.match(/^([1-6])월\s*([1-9]|1\d|2[0-5])일$/);
  if (mDate) return parseInt(mDate[1], 10) + '-' + parseInt(mDate[2], 10);

  return '';
}

function tryExtractClassKeyFromText_(blob) {
  var s = String(blob || '');
  var m1 = s.match(/(?:제\s*)?([1-6])\s*학년\s*([1-9]|1\d|2[0-5])\s*반/);
  if (m1) return parseInt(m1[1], 10) + '-' + parseInt(m1[2], 10);
  var m2 = s.match(/\b([1-6])\s*-\s*([1-9]|1\d|2[0-5])\s*(?:반)?\b/);
  if (m2) return parseInt(m2[1], 10) + '-' + parseInt(m2[2], 10);
  return '';
}

function normalizeClassKey_(raw) {
  var strict = tryExtractClassKeyStrict_(raw);
  if (strict) return strict;
  var fromText = tryExtractClassKeyFromText_(raw);
  if (fromText) return fromText;
  return String(raw || '').trim();
}

function isActivityBracket_(bracketStr) {
  var kw = ['동아리', '학급회의', '봉사', '자율', '진로', '활동', '선택', '이동', '보강', '합반', '강당', '체육관', '실'];
  for (var i = 0; i < kw.length; i++) {
    if (bracketStr.indexOf(kw[i]) !== -1) return true;
  }
  return false;
}

function isChangcheSubject_(subj) {
  var s = String(subj || '');
  return (
    s.indexOf('창체') !== -1 ||
    s.indexOf('창의적체험') !== -1 ||
    s.indexOf('자율') !== -1 ||
    s === '동아리' ||
    s === '봉사'
  );
}

function isIgnoredEntityName_(name) {
  var n = String(name || '').replace(/\s+/g, '');
  if (!n) return true;
  if (/^\d+$/.test(n)) return true;
  var ignoreList = ['교시', '요일', '합계', '계', '총계', '시수', '성명', '교사', '교사명', '이름', '학급', '구분', '비고', '번호', '연번'];
  return ignoreList.indexOf(n) !== -1;
}

function countNonEmptyCols_(row, startCol) {
  if (!row) return 0;
  var cnt = 0;
  for (var c = startCol; c < row.length; c++) {
    if (String(row[c] || '').trim() !== '') cnt++;
  }
  return cnt;
}

function findColIndex_(headers, candidates) {
  for (var i = 0; i < candidates.length; i++) {
    var idx = headers.indexOf(candidates[i]);
    if (idx !== -1) return idx;
  }
  for (var j = 0; j < headers.length; j++) {
    for (var k = 0; k < candidates.length; k++) {
      if (headers[j].indexOf(candidates[k]) !== -1) return j;
    }
  }
  return -1;
}

function createEmptyGrid_(periods, daysCount) {
  var g = [];
  for (var p = 0; p < periods; p++) {
    var row = [];
    for (var d = 0; d < daysCount; d++) {
      row.push(null);
    }
    g.push(row);
  }
  return g;
}

/* ============================================================================
   학기별 시트(탭) 세트 자동 인식 · 이름 변경 · 업로드 시트 생성 API
   - 시트 명명 규칙: '20XX-X주간시간표', '20XX-X학급시간표' (교사시간표 명칭 미사용)
   - 기존 '주간시간표', '학급시간표' 시트는 '2025-2주간시간표', '2025-2학급시간표'로 자동 변경
   ============================================================================ */
var PROP_ACTIVE_PROJECT_KEY = 'ACTIVE_TIMETABLE_SEMESTER_PREFIX_V2';

/**
 * 입력 문자열(예: '2026년 1학기', '2026-1', '2025-2주간시간표')을 '20XX-X' 접두어로 정규화
 */
function normalizeSemesterPrefix_(rawInput) {
  var s = String(rawInput || '').trim();
  if (!s || s === '__SHEET__') return '2025-2';
  var m = s.match(/(20\d{2})\s*(?:년|학년도|[-_. ])\s*([12])\s*(?:학기)?/);
  if (m) return m[1] + '-' + m[2];
  var mCompact = s.match(/^(20\d{2})0?([12])$/);
  if (mCompact) return mCompact[1] + '-' + mCompact[2];
  var cleaned = s
    .replace(/(?:주간\s*시간표|학급\s*시간표|반별\s*시간표|교사\s*그룹|선택\s*과목\s*[23]\s*학년)$/g, '')
    .replace(/[-_.\s]+$/g, '')
    .trim();
  return cleaned || '2025-2';
}

function formatSemesterDisplayName_(prefix) {
  var p = normalizeSemesterPrefix_(prefix);
  var m = p.match(/^(20\d{2})-([12])$/);
  if (m) {
    return m[1] + '년 ' + m[2] + '학기';
  }
  return p;
}

/**
 * 기존 스프레드시트에 '주간시간표', '학급시간표'로 저장되어 있는 시트명을
 * '2025-2주간시간표', '2025-2학급시간표'로 자동 변경하고,
 * 이전 버전의 '*교사그룹' 시트명 및 헤더를 표준 '20XX-X교사그룹'('그룹명')으로 정규화
 */
function ensureDefaultSemesterSheetNames_(ss) {
  if (!ss) return;
  try {
    var targetWeeklyName = '2025-2주간시간표';
    var targetClassName = '2025-2학급시간표';

    if (!ss.getSheetByName(targetWeeklyName)) {
      var legacyWeekly = ss.getSheetByName('주간시간표') || ss.getSheetByName('주간 시간표');
      if (legacyWeekly) {
        legacyWeekly.setName(targetWeeklyName);
      }
    }

    if (!ss.getSheetByName(targetClassName)) {
      var legacyClass =
        ss.getSheetByName('학급시간표') ||
        ss.getSheetByName('학급 시간표') ||
        ss.getSheetByName('반별시간표');
      if (legacyClass) {
        legacyClass.setName(targetClassName);
      }
    }

    // 기존 스프레드시트에 이전 명칭('*교사\uBB36\uC74C') 시트가 존재하면 '*교사그룹'으로 시트명과 헤더 내용을 자동 변경
    var legacySuffix = '교사\uBB36\uC74C';
    var legacyHeader = '\uBB36\uC74C명';
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sh = sheets[i];
      var sName = String(sh.getName() || '').trim();
      if (sName.indexOf(legacySuffix) !== -1) {
        var newGroupSheetName = sName.replace(legacySuffix, '교사그룹');
        if (!ss.getSheetByName(newGroupSheetName)) {
          sh.setName(newGroupSheetName);
        }
        try {
          var a1Val = String(sh.getRange(1, 1).getDisplayValue() || '').trim();
          if (a1Val === legacyHeader || a1Val.indexOf('\uBB36\uC74C') !== -1) {
            sh.getRange(1, 1).setValue('그룹명');
          }
        } catch (headerErr) {}
      }
    }
  } catch (e) {}
}

/**
 * 스프레드시트 내 모든 '20XX-X주간시간표' 및 '20XX-X학급시간표' 시트 세트를 스캔하여 반환
 */
function discoverSemesterSheetSets_(ss) {
  if (!ss) return [];
  var sheets = ss.getSheets();
  var map = {};
  var order = [];

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var sName = String(sh.getName() || '').trim();
    if (!sName || sName.charAt(0) === '_') continue;

    var m = sName.match(
      /^(.+?)[-_ ]?(주간\s*시간표|학급\s*시간표|반별\s*시간표|선택\s*과목\s*2\s*학년|선택\s*과목\s*3\s*학년)$/
    );
    if (!m) continue;

    var rawPrefix = String(m[1] || '').trim();
    var roleText = String(m[2] || '').replace(/\s+/g, '');
    var prefix = normalizeSemesterPrefix_(rawPrefix);

    if (!map[prefix]) {
      map[prefix] = {
        prefix: prefix,
        name: formatSemesterDisplayName_(prefix),
        weeklySheet: null,
        classSheet: null,
        elective2Sheet: null,
        elective3Sheet: null,
        weeklySheetName: prefix + '주간시간표',
        classSheetName: prefix + '학급시간표',
        elective2SheetName: prefix + '선택과목2학년',
        elective3SheetName: prefix + '선택과목3학년'
      };
      order.push(prefix);
    }

    if (roleText === '주간시간표') {
      map[prefix].weeklySheet = sh;
      map[prefix].weeklySheetName = sName;
    } else if (roleText === '학급시간표' || roleText === '반별시간표') {
      map[prefix].classSheet = sh;
      map[prefix].classSheetName = sName;
    } else if (roleText === '선택과목2학년') {
      map[prefix].elective2Sheet = sh;
      map[prefix].elective2SheetName = sName;
    } else if (roleText === '선택과목3학년') {
      map[prefix].elective3Sheet = sh;
      map[prefix].elective3SheetName = sName;
    }
  }

  order.sort(function (a, b) {
    return b.localeCompare(a, 'ko');
  });

  return order.map(function (k) {
    return map[k];
  });
}

/**
 * 2차원 셀 배열을 지정한 이름의 시트(탭)에 생성 또는 덮어쓰기로 기록
 */
function writeRowsToSheet_(ss, sheetName, rows) {
  if (!ss || !sheetName || !Array.isArray(rows) || rows.length === 0) return null;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    try {
      sheet.showSheet();
    } catch (e) {}
    sheet.clearContents();
  }

  var maxCols = 1;
  for (var r = 0; r < rows.length; r++) {
    if (Array.isArray(rows[r]) && rows[r].length > maxCols) {
      maxCols = rows[r].length;
    }
  }

  var rect = [];
  for (var i = 0; i < rows.length; i++) {
    var srcRow = Array.isArray(rows[i]) ? rows[i] : [];
    var newRow = [];
    for (var c = 0; c < maxCols; c++) {
      var v = srcRow[c];
      newRow.push(v === undefined || v === null ? '' : String(v));
    }
    rect.push(newRow);
  }

  sheet.getRange(1, 1, rect.length, maxCols).setValues(rect);
  return sheet;
}

/**
 * 업로드된 주간시간표 + 학급시간표 (+ 선택과목2학년 + 선택과목3학년) 2차원 배열 데이터를
 * 스프레드시트에 '20XX-X주간시간표', '20XX-X학급시간표', '20XX-X선택과목2학년', '20XX-X선택과목3학년' 시트로 추가·저장하고 파싱 결과 반환
 */
function saveSemesterSheetsToSpreadsheet(requestJson) {
  var req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson;
  if (!req) {
    throw new Error('업로드 데이터가 전달되지 않았습니다.');
  }

  var ss = getTargetSpreadsheet_();
  if (!ss) {
    throw new Error('연결된 구글 스프레드시트를 찾을 수 없습니다.');
  }

  ensureDefaultSemesterSheetNames_(ss);

  var prefix = normalizeSemesterPrefix_(req.prefix || req.name || '2026-1');
  var weeklySheetName = prefix + '주간시간표';
  var classSheetName = prefix + '학급시간표';
  var elective2SheetName = prefix + '선택과목2학년';
  var elective3SheetName = prefix + '선택과목3학년';

  if (Array.isArray(req.weeklyRows) && req.weeklyRows.length > 0) {
    writeRowsToSheet_(ss, weeklySheetName, req.weeklyRows);
  }
  if (Array.isArray(req.classRows) && req.classRows.length > 0) {
    writeRowsToSheet_(ss, classSheetName, req.classRows);
  }
  if (Array.isArray(req.elective2Rows) && req.elective2Rows.length > 0) {
    writeRowsToSheet_(ss, elective2SheetName, req.elective2Rows);
  }
  if (Array.isArray(req.elective3Rows) && req.elective3Rows.length > 0) {
    writeRowsToSheet_(ss, elective3SheetName, req.elective3Rows);
  }

  PropertiesService.getScriptProperties().setProperty(PROP_ACTIVE_PROJECT_KEY, prefix);
  clearTimetableCache_();

  var payload = buildTimetablePayloadFromRealSheets_();
  var serialized = JSON.stringify(payload);
  if (payload && payload.ok) {
    putCachedJson_(serialized);
  }
  return serialized;
}

/**
 * 상단 드롭다운 또는 프로젝트 목록에서 학기('20XX-X') 선택 시 해당 시트 세트를 읽어와 반환
 */
function switchActiveSemesterOnServer(prefixInput) {
  var prefix = normalizeSemesterPrefix_(prefixInput || '2025-2');
  PropertiesService.getScriptProperties().setProperty(PROP_ACTIVE_PROJECT_KEY, prefix);
  clearTimetableCache_();

  var payload = buildTimetablePayloadFromRealSheets_();
  var serialized = JSON.stringify(payload);
  if (payload && payload.ok) {
    putCachedJson_(serialized);
  }
  return serialized;
}

/**
 * 특정 학기의 '20XX-X주간시간표', '20XX-X학급시간표', '20XX-X선택과목2학년', '20XX-X선택과목3학년' 시트(탭)를 스프레드시트에서 삭제
 */
function deleteSemesterSheetsOnServer(prefixInput) {
  var prefix = normalizeSemesterPrefix_(prefixInput);
  var ss = getTargetSpreadsheet_();
  if (!ss) {
    throw new Error('연결된 구글 스프레드시트를 찾을 수 없습니다.');
  }

  ensureDefaultSemesterSheetNames_(ss);

  var targetNames = [
    prefix + '주간시간표',
    prefix + '학급시간표',
    prefix + '선택과목2학년',
    prefix + '선택과목3학년'
  ];

  for (var i = 0; i < targetNames.length; i++) {
    var sh = ss.getSheetByName(targetNames[i]);
    if (sh && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  }

  var remainingSets = discoverSemesterSheetSets_(ss);
  var nextPrefix = remainingSets.length > 0 ? remainingSets[0].prefix : '2025-2';
  PropertiesService.getScriptProperties().setProperty(PROP_ACTIVE_PROJECT_KEY, nextPrefix);
  clearTimetableCache_();

  var payload = buildTimetablePayloadFromRealSheets_();
  var serialized = JSON.stringify(payload);
  if (payload && payload.ok) {
    putCachedJson_(serialized);
  }
  return serialized;
}

/**
 * 특정 학기(prefix)의 개별 시트('weekly' | 'class' | 'elective2' | 'elective3')만 스프레드시트에서 삭제
 */
function deleteSingleRoleSheetOnServer(requestJson) {
  var req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson;
  if (!req || !req.slotType) {
    throw new Error('삭제할 파일(시트) 종류가 전달되지 않았습니다.');
  }

  var ss = getTargetSpreadsheet_();
  if (!ss) {
    throw new Error('연결된 구글 스프레드시트를 찾을 수 없습니다.');
  }

  ensureDefaultSemesterSheetNames_(ss);

  var prefix = normalizeSemesterPrefix_(req.prefix || '2026-2');
  var slotType = String(req.slotType || '').trim();
  var roleSuffixMap = {
    weekly: '주간시간표',
    class: '학급시간표',
    elective2: '선택과목2학년',
    elective3: '선택과목3학년'
  };
  var suffix = roleSuffixMap[slotType];
  if (!suffix) {
    throw new Error('유효하지 않은 파일 슬롯입니다: ' + slotType);
  }

  var targetSheetName = prefix + suffix;
  var sh = ss.getSheetByName(targetSheetName);
  if (sh) {
    if (ss.getSheets().length <= 1) {
      sh.clearContents();
    } else {
      ss.deleteSheet(sh);
    }
  }

  clearTimetableCache_();

  var payload = buildTimetablePayloadFromRealSheets_();
  var serialized = JSON.stringify(payload);
  if (payload && payload.ok) {
    putCachedJson_(serialized);
  }
  return serialized;
}

/**
 * 스프레드시트에 존재하는 학기별 시트 세트 목록 및 활성 학기 반환
 */
function getServerProjectsBundle() {
  var ss = getTargetSpreadsheet_();
  if (!ss) {
    return JSON.stringify({ ok: false, activeProjectId: '2025-2', semesterSets: [] });
  }
  ensureDefaultSemesterSheetNames_(ss);
  var sets = discoverSemesterSheetSets_(ss).map(function (item) {
    return {
      id: item.prefix,
      prefix: item.prefix,
      name: item.name,
      weeklySheetName: item.weeklySheet ? item.weeklySheetName : '',
      classSheetName: item.classSheet ? item.classSheetName : '',
      elective2SheetName: item.elective2Sheet ? item.elective2SheetName : '',
      elective3SheetName: item.elective3Sheet ? item.elective3SheetName : ''
    };
  });
  var props = PropertiesService.getScriptProperties();
  var activeId = normalizeSemesterPrefix_(props.getProperty(PROP_ACTIVE_PROJECT_KEY) || '2025-2');
  return JSON.stringify({
    ok: true,
    activeProjectId: activeId,
    semesterSets: sets
  });
}

function setActiveProjectOnServer(projectId) {
  return switchActiveSemesterOnServer(projectId);
}

function deleteProjectOnServer(projectId) {
  return deleteSemesterSheetsOnServer(projectId);
}

/* ============================================================================
   공유 공강 확인: 복수 교사 그룹('2026-2교사그룹' / '<prefix>교사그룹') 시트 파싱 및 저장 API
   ============================================================================ */

/**
 * 학기 접두어(예: '2026-2')에 대응하는 교사그룹 시트명 반환 (예: '2026-2교사그룹')
 */
function getTeacherGroupSheetName_(prefix) {
  var norm = normalizeSemesterPrefix_(prefix || '2026-2');
  return norm + '교사그룹';
}

/**
 * 스프레드시트에서 현재 학기의 교사그룹 시트 탐색 ('2026-2교사그룹' 폴백 지원)
 */
function findTeacherGroupSheet_(allSheets, allSheetNames, targetPrefix) {
  var primaryName = getTeacherGroupSheetName_(targetPrefix);
  var candidates = [primaryName];
  if (candidates.indexOf('2026-2교사그룹') === -1) {
    candidates.push('2026-2교사그룹');
  }
  candidates.push('교사그룹');

  for (var i = 0; i < candidates.length; i++) {
    var exactIdx = allSheetNames.indexOf(candidates[i]);
    if (exactIdx !== -1) return allSheets[exactIdx];
  }

  var normPrimary = primaryName.replace(/\s+/g, '');
  for (var j = 0; j < allSheets.length; j++) {
    var sNorm = String(allSheetNames[j] || '').replace(/\s+/g, '');
    if (sNorm === normPrimary || sNorm === '2026-2교사그룹' || sNorm === '교사그룹') {
      return allSheets[j];
    }
  }
  return null;
}

/**
 * 교사그룹 시트('2026-2교사그룹')에서 복수 교사 그룹 목록을 파싱하여 반환
 * - 1열(A열): 그룹명 (예: '부장교사')
 * - 2열(B열) 이후: 쉼표 구분 교사 명단('김동진, 박수빈') 또는 열별 교사 성명 나열 모두 지원
 */
function parseTeacherGroupsFromSheet_(sheet) {
  if (!sheet) return [];
  var rows = [];
  try {
    rows = sheet.getDataRange().getDisplayValues();
  } catch (e) {
    return [];
  }
  if (!rows || rows.length === 0) return [];

  var groups = [];
  var groupIndexMap = {};

  for (var r = 0; r < rows.length; r++) {
    var row = rows[r] || [];
    var rawGroupName = String(row[0] || '').trim();
    if (!rawGroupName) continue;

    // 헤더 행 건너뛰기
    var headerCheck = rawGroupName.replace(/\s+/g, '');
    if (
      r === 0 &&
      (headerCheck === '그룹명' ||
        headerCheck === '그룹이름' ||
        headerCheck === '교사그룹' ||
        headerCheck === '구분' ||
        headerCheck.indexOf('\uBB36\uC74C') !== -1)
    ) {
      continue;
    }

    var teacherList = [];
    var seen = {};

    for (var c = 1; c < row.length; c++) {
      var cellVal = String(row[c] || '').trim();
      if (!cellVal) continue;
      // 인원수 숫자 열('5', '5명') 또는 일시 열('2026-11-04 ...')은 교사명에서 제외
      if (/^\d+\s*명?$/.test(cellVal)) continue;
      if (/^20\d{2}[-./]\d{1,2}[-./]\d{1,2}/.test(cellVal)) continue;

      var tokens = cellVal.split(/[,/;\r\n]+/);
      for (var t = 0; t < tokens.length; t++) {
        var cleaned = cleanTeacherIdentity_(tokens[t], '').name;
        if (!cleaned || isIgnoredEntityName_(cleaned)) continue;
        if (/^\d+$/.test(cleaned)) continue;
        if (!seen[cleaned]) {
          seen[cleaned] = true;
          teacherList.push(cleaned);
        }
      }
    }

    if (teacherList.length === 0) continue;

    if (groupIndexMap[rawGroupName] !== undefined) {
      groups[groupIndexMap[rawGroupName]].teachers = teacherList;
    } else {
      groupIndexMap[rawGroupName] = groups.length;
      groups.push({
        name: rawGroupName,
        teachers: teacherList
      });
    }
  }

  return groups;
}

/**
 * 교사 그룹 배열을 지정된 시트(예: '2026-2교사그룹')에 생성 또는 덮어쓰기로 저장
 */
function writeTeacherGroupsToSheet_(ss, sheetName, groups) {
  if (!ss || !sheetName) return null;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    try {
      sheet.showSheet();
    } catch (e) {}
    sheet.clearContents();
  }

  var nowStr = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
  var rows = [['그룹명', '교사명단', '교사수', '수정일시']];

  var list = Array.isArray(groups) ? groups : [];
  for (var i = 0; i < list.length; i++) {
    var g = list[i];
    if (!g || !g.name || !Array.isArray(g.teachers) || g.teachers.length === 0) continue;
    rows.push([
      String(g.name).trim(),
      g.teachers.join(', '),
      String(g.teachers.length),
      nowStr
    ]);
  }

  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  return sheet;
}

/**
 * 클라이언트에서 선택한 복수 교사 그룹을 스프레드시트('2026-2교사그룹' 등)에 추가/업데이트
 */
function saveTeacherGroupOnServer(requestJson) {
  var req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson;
  if (!req || !req.groupName) {
    throw new Error('교사 그룹 이름을 입력해 주세요.');
  }

  var ss = getTargetSpreadsheet_();
  if (!ss) {
    throw new Error('연결된 구글 스프레드시트를 찾을 수 없습니다.');
  }

  ensureDefaultSemesterSheetNames_(ss);

  var groupName = String(req.groupName || '').trim();
  var rawTeachers = Array.isArray(req.teachers) ? req.teachers : [];
  var cleanTeachers = [];
  var seen = {};
  for (var i = 0; i < rawTeachers.length; i++) {
    var tName = cleanTeacherIdentity_(rawTeachers[i], '').name;
    if (tName && !seen[tName]) {
      seen[tName] = true;
      cleanTeachers.push(tName);
    }
  }

  if (cleanTeachers.length === 0) {
    throw new Error('그룹에 포함할 교사를 1명 이상 선택해 주세요.');
  }

  var props = PropertiesService.getScriptProperties();
  var savedPrefix = props.getProperty(PROP_ACTIVE_PROJECT_KEY) || '2026-2';
  var prefix = normalizeSemesterPrefix_(req.prefix || savedPrefix || '2026-2');
  var sheetName = getTeacherGroupSheetName_(prefix);

  var existingSheet = ss.getSheetByName(sheetName);
  if (!existingSheet && prefix !== '2026-2') {
    var fallback2026 = ss.getSheetByName('2026-2교사그룹');
    if (fallback2026 && !req.prefix) {
      sheetName = '2026-2교사그룹';
      existingSheet = fallback2026;
    }
  }

  var groups = existingSheet ? parseTeacherGroupsFromSheet_(existingSheet) : [];
  var updated = false;
  for (var gIdx = 0; gIdx < groups.length; gIdx++) {
    if (groups[gIdx].name === groupName) {
      groups[gIdx].teachers = cleanTeachers;
      updated = true;
      break;
    }
  }
  if (!updated) {
    groups.push({
      name: groupName,
      teachers: cleanTeachers
    });
  }

  writeTeacherGroupsToSheet_(ss, sheetName, groups);
  clearTimetableCache_();

  return JSON.stringify({
    ok: true,
    sheetName: sheetName,
    teacherGroups: groups
  });
}

/**
 * 지정된 교사 그룹을 스프레드시트('2026-2교사그룹' 등)에서 삭제
 */
function deleteTeacherGroupOnServer(requestJson) {
  var req = typeof requestJson === 'string' ? JSON.parse(requestJson) : requestJson;
  if (!req || !req.groupName) {
    throw new Error('삭제할 교사 그룹 이름이 전달되지 않았습니다.');
  }

  var ss = getTargetSpreadsheet_();
  if (!ss) {
    throw new Error('연결된 구글 스프레드시트를 찾을 수 없습니다.');
  }

  ensureDefaultSemesterSheetNames_(ss);

  var groupName = String(req.groupName || '').trim();
  var props = PropertiesService.getScriptProperties();
  var savedPrefix = props.getProperty(PROP_ACTIVE_PROJECT_KEY) || '2026-2';
  var prefix = normalizeSemesterPrefix_(req.prefix || savedPrefix || '2026-2');
  var sheetName = getTeacherGroupSheetName_(prefix);

  var existingSheet = ss.getSheetByName(sheetName) || ss.getSheetByName('2026-2교사그룹');
  if (existingSheet) {
    sheetName = existingSheet.getName();
  }

  var groups = existingSheet ? parseTeacherGroupsFromSheet_(existingSheet) : [];
  var filtered = groups.filter(function (g) {
    return g.name !== groupName;
  });

  writeTeacherGroupsToSheet_(ss, sheetName, filtered);
  clearTimetableCache_();

  return JSON.stringify({
    ok: true,
    sheetName: sheetName,
    teacherGroups: filtered
  });
}

/* ============================================================================
   선택과목(2학년 · 3학년) 시트 탐색, 파싱 및 실제 강의실(교실)-교과-교사 정밀 매핑 엔진
   ============================================================================ */

/**
 * 스프레드시트에서 현재 학기의 2학년/3학년 선택과목 시트 탐색
 * ('<prefix>선택과목2학년', '2026-2선택과목2학년', '선택과목2학년' 등)
 */
function findElectiveSheetByGrade_(allSheets, allSheetNames, targetPrefix, grade) {
  var gNum = Number(grade) === 3 ? 3 : 2;
  var normPrefix = normalizeSemesterPrefix_(targetPrefix || '2026-2');
  var primaryName = normPrefix + '선택과목' + gNum + '학년';
  var candidates = [primaryName];
  var fallback2026 = '2026-2선택과목' + gNum + '학년';
  if (candidates.indexOf(fallback2026) === -1) {
    candidates.push(fallback2026);
  }
  candidates.push('선택과목' + gNum + '학년');

  for (var i = 0; i < candidates.length; i++) {
    var exactIdx = allSheetNames.indexOf(candidates[i]);
    if (exactIdx !== -1) return allSheets[exactIdx];
  }

  var normPrimary = primaryName.replace(/\s+/g, '');
  var normFallback = fallback2026.replace(/\s+/g, '');
  var normShort = '선택과목' + gNum + '학년';
  for (var j = 0; j < allSheets.length; j++) {
    var sNorm = String(allSheetNames[j] || '').replace(/\s+/g, '');
    if (sNorm === normPrimary || sNorm === normFallback || sNorm === normShort) {
      return allSheets[j];
    }
  }
  return null;
}

/**
 * 선택과목 2학년·3학년 시트를 파싱하여 store에 적용하고,
 * 가상 학급(10반 이상) 제거 및 학년별 지정 특별실(211호·416호·315호·정보실) 등록을 수행합니다.
 */
function applyElectiveSheetsToStore_(store, elective2Sheet, elective3Sheet) {
  if (!store) return;
  if (!store.gradeSpecialRooms) {
    store.gradeSpecialRooms = { 2: {}, 3: {} };
  }
  if (elective2Sheet) {
    try {
      var rows2 = elective2Sheet.getDataRange().getDisplayValues();
      var groupMap2 = parseElectiveSheetRows_(rows2);
      applyElectiveClassroomMapping_(store, 2, groupMap2);
    } catch (e) {}
  }
  if (elective3Sheet) {
    try {
      var rows3 = elective3Sheet.getDataRange().getDisplayValues();
      var groupMap3 = parseElectiveSheetRows_(rows3);
      applyElectiveClassroomMapping_(store, 3, groupMap3);
    } catch (e) {}
  }
  finalizeSpecialRoomsAndCleanupVirtualClasses_(store);
}

/**
 * 2학년·3학년 선택과목 2차원 배열 데이터를 파싱하여 그룹별(A~F) 수업 배열 반환
 * - 1행(또는 그룹 헤더 행): A, , , B, , , C, , , D ...
 * - 다음 행: 과목, 교사, 강의실
 * - 이후 행: 과목명, 교사명, 강의실 (하단 집계 숫자/호실 행 자동 제외)
 */
function parseElectiveSheetRows_(rows) {
  var groupMap = {};
  if (!Array.isArray(rows) || rows.length < 2) return groupMap;

  var headerRowIdx = -1;
  var groupBlocks = [];

  for (var r = 0; r < Math.min(rows.length - 1, 10); r++) {
    var row = rows[r] || [];
    var nextRow = rows[r + 1] || [];
    var blocks = [];

    for (var c = 0; c < row.length; c++) {
      var cellStr = String(row[c] || '').trim();
      var mGrp = cellStr.match(/^([A-H])(?:\s*(?:군|그룹|선택|타임))?$/i);
      if (!mGrp) continue;
      var subH0 = String(nextRow[c] || '').replace(/\s+/g, '');
      var subH1 = String(nextRow[c + 1] || '').replace(/\s+/g, '');
      var subH2 = String(nextRow[c + 2] || '').replace(/\s+/g, '');
      if (
        subH0.indexOf('과목') !== -1 ||
        subH1.indexOf('교사') !== -1 ||
        subH2.indexOf('강의실') !== -1 ||
        subH2.indexOf('교실') !== -1
      ) {
        blocks.push({
          group: mGrp[1].toUpperCase(),
          colIdx: c
        });
      }
    }

    if (blocks.length > 0) {
      headerRowIdx = r;
      groupBlocks = blocks;
      break;
    }
  }

  if (headerRowIdx === -1 || groupBlocks.length === 0) return groupMap;

  for (var b = 0; b < groupBlocks.length; b++) {
    var grp = groupBlocks[b].group;
    var baseCol = groupBlocks[b].colIdx;
    if (!groupMap[grp]) groupMap[grp] = [];

    for (var rIdx = headerRowIdx + 2; rIdx < rows.length; rIdx++) {
      var dataRow = rows[rIdx] || [];
      var rawSubj = String(dataRow[baseCol] || '').trim();
      var rawTeacher = String(dataRow[baseCol + 1] || '').trim();
      var rawRoom = String(dataRow[baseCol + 2] || '').trim();

      if (!rawSubj && !rawTeacher && !rawRoom) continue;
      // 하단 집계 행('301호', '302호' 또는 숫자 '30', '21')은 무시
      if (/^\d+$/.test(rawSubj) || /^\d{3}\s*호?$/.test(rawSubj) || rawSubj === '정보실') continue;
      if (/^\d+$/.test(rawTeacher) || /^\d{3}\s*호?$/.test(rawTeacher)) continue;
      if (!rawSubj || !rawTeacher || !rawRoom) continue;

      var parsedEntries = parseElectiveCourseRowEntry_(grp, rawSubj, rawTeacher, rawRoom);
      for (var pIdx = 0; pIdx < parsedEntries.length; pIdx++) {
        groupMap[grp].push(parsedEntries[pIdx]);
      }
    }
  }

  return groupMap;
}

/**
 * 요일 표기('(월)', '(화)' 등)에서 요일 인덱스(0=월..4=금) 배열 추출
 */
function extractDayIndicesFromToken_(str) {
  var s = String(str || '');
  var m = s.match(/\(([월화수목금,\s/·]+)\)/);
  if (!m) return null;
  var dayChars = m[1];
  var dayMap = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };
  var indices = [];
  for (var i = 0; i < dayChars.length; i++) {
    var ch = dayChars.charAt(i);
    if (dayMap[ch] !== undefined && indices.indexOf(dayMap[ch]) === -1) {
      indices.push(dayMap[ch]);
    }
  }
  return indices.length > 0 ? indices : null;
}

/**
 * 강의실 표기 정규화 ('301' -> '301호', '301호' -> '301호', '정보실' -> '정보실')
 */
function normalizeElectiveRoomName_(rawRoom) {
  var r = String(rawRoom || '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  if (!r) return '';
  if (/^\d{3}$/.test(r)) return r + '호';
  var m = r.match(/^(\d{3})\s*호$/);
  if (m) return m[1] + '호';
  return r;
}

/**
 * 선택과목 단일 행(요일 분리 복합 수업 포함)을 파싱하여 수업 엔트리 배열 반환
 * 예1) 과목="환경, 논술", 교사="김진비, 이수연(화)", 강의실="405호"
 * 예2) 과목="중국문화, 논술", 교사="김영애, 박인태(월)", 강의실="211호, 401호"
 */
function parseElectiveCourseRowEntry_(groupCode, rawSubj, rawTeacher, rawRoom) {
  var subjParts = String(rawSubj || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var teacherParts = String(rawTeacher || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);
  var roomParts = String(rawRoom || '')
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);

  var count = Math.max(subjParts.length, teacherParts.length, roomParts.length);
  if (count <= 1) {
    var singleDays = extractDayIndicesFromToken_(rawTeacher) || extractDayIndicesFromToken_(rawSubj);
    var cleanT = cleanTeacherIdentity_(String(rawTeacher || '').replace(/\([^)]*\)/g, ''), '').name;
    var cleanS = String(rawSubj || '')
      .replace(/\*+/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
    var cleanR = normalizeElectiveRoomName_(rawRoom);
    if (!cleanS || !cleanT || !cleanR) return [];
    return [
      {
        group: groupCode,
        subject: cleanS,
        rawSubject: rawSubj,
        teacher: cleanT,
        room: cleanR,
        dayFilter: singleDays,
        excludeDays: null
      }
    ];
  }

  var rawItems = [];
  var explicitDaysUnion = [];

  for (var i = 0; i < count; i++) {
    var sPart = subjParts[Math.min(i, subjParts.length - 1)] || '';
    var tPart = teacherParts[Math.min(i, teacherParts.length - 1)] || '';
    var rPart = roomParts[Math.min(i, roomParts.length - 1)] || '';

    var days =
      extractDayIndicesFromToken_(tPart) ||
      extractDayIndicesFromToken_(sPart) ||
      extractDayIndicesFromToken_(rPart);
    if (days) {
      for (var d = 0; d < days.length; d++) {
        if (explicitDaysUnion.indexOf(days[d]) === -1) {
          explicitDaysUnion.push(days[d]);
        }
      }
    }

    var cleanTName = cleanTeacherIdentity_(tPart.replace(/\([^)]*\)/g, ''), '').name;
    var cleanSName = sPart
      .replace(/\*+/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim();
    var cleanRName = normalizeElectiveRoomName_(rPart);

    if (cleanSName && cleanTName && cleanRName) {
      rawItems.push({
        group: groupCode,
        subject: cleanSName,
        rawSubject: sPart,
        teacher: cleanTName,
        room: cleanRName,
        dayFilter: days,
        excludeDays: null
      });
    }
  }

  // 한 행 안에서 특정 요일(예: '(월)', '(화)', '(목)', '(금)')만 지정된 항목이 있으면
  // 요일 미지정 기본 항목은 해당 요일을 제외한 나머지 요일에 배정됨
  if (explicitDaysUnion.length > 0) {
    for (var j = 0; j < rawItems.length; j++) {
      if (!rawItems[j].dayFilter) {
        rawItems[j].excludeDays = explicitDaysUnion.slice();
      }
    }
  }

  return rawItems;
}

/**
 * 학년(2 또는 3)과 강의실명('301호'~'309호', '401호'~'409호', '211호', '416호', '315호', '정보실' 등)을
 * 학급 키('2-1'~'2-9', '3-1'~'3-9') 또는 학년 전용 이동교실로 매핑
 */
function mapElectiveRoomToGradeClass_(grade, roomName) {
  var gNum = Number(grade) === 3 ? 3 : 2;
  var normRoom = normalizeElectiveRoomName_(roomName);
  if (!normRoom) {
    return { classKey: '', roomLabel: '', isSpecialRoom: false };
  }

  if (gNum === 2) {
    var m2 = normRoom.match(/^30([1-9])호$/);
    if (m2) {
      return {
        classKey: '2-' + m2[1],
        roomLabel: normRoom,
        isSpecialRoom: false
      };
    }
  } else if (gNum === 3) {
    var m3 = normRoom.match(/^40([1-9])호$/);
    if (m3) {
      return {
        classKey: '3-' + m3[1],
        roomLabel: normRoom,
        isSpecialRoom: false
      };
    }
  }

  return {
    classKey: '',
    roomLabel: normRoom,
    isSpecialRoom: true
  };
}

/**
 * 특정 그룹(A~F)의 수업 목록 중 해당 요일(dayIdx: 0~4)에 실제 운영되는 수업만 필터링
 */
function getElectiveGroupLessonsForDay_(groupCourses, dayIdx) {
  if (!Array.isArray(groupCourses)) return [];
  var result = [];
  for (var i = 0; i < groupCourses.length; i++) {
    var item = groupCourses[i];
    if (!item) continue;
    if (Array.isArray(item.dayFilter) && item.dayFilter.length > 0) {
      if (item.dayFilter.indexOf(dayIdx) === -1) continue;
    }
    if (Array.isArray(item.excludeDays) && item.excludeDays.length > 0) {
      if (item.excludeDays.indexOf(dayIdx) !== -1) continue;
    }
    result.push(item);
  }
  return result;
}

/**
 * 과목명에서 선택과목 그룹 코드([A], A_선택, A군, A선택, D_영문 등) 힌트 추출
 */
function extractElectiveGroupHint_(subjectStr) {
  var s = String(subjectStr || '').trim();
  if (!s) return '';
  var m =
    s.match(/^\[([A-H])\]/i) ||
    s.match(/^\(([A-H])\)/i) ||
    s.match(/^([A-H])\s*[-_·]?\s*(?:군|그룹|선택|타임)(?=$|\s|_|\[|\(|[가-힣A-Za-z0-9])/i) ||
    s.match(/^([A-H])\s*_\s*[가-힣A-Za-z]/i) ||
    s.match(/(?:^|\s|\[|\()([A-H])\s*[-_]?\s*선택/i) ||
    s.match(/^선택\s*[-_]?\s*([A-H])(?=$|\s|_|\(|\[)/i);
  return m ? m[1].toUpperCase() : '';
}

/**
 * 과목명 앞의 선택과목 그룹 접두어([A], A_선택, A군, D_ 등)를 제거하여 순수 교과명만 반환
 */
function stripElectiveGroupPrefix_(subjectStr) {
  var s = String(subjectStr || '').trim();
  if (!s) return '';
  return s
    .replace(/^\[[A-H]\]\s*/i, '')
    .replace(/^\([A-H]\)\s*/i, '')
    .replace(/^[A-H]\s*[-_·]?\s*(?:군|그룹|선택|타임)\s*[-_·:]?\s*/i, '')
    .replace(/^선택\s*[-_]?\s*[A-H]\s*[-_·:]?\s*/i, '')
    .replace(/^[A-H]\s*_\s*/i, '')
    .trim();
}

/**
 * 2행 셀의 두 번째 줄 텍스트가 교사명이 아니라 교과명인지 판별
 */
function isLikelySubjectToken_(str) {
  var s = String(str || '').replace(/\s+/g, '');
  if (!s) return false;
  if (/[12ⅠⅡ]/.test(s)) return true;
  if (s.length >= 4) return true;
  var knownSubjects = [
    '미적분', '미적', '확통', '독서', '문학', '국어', '수학', '영어',
    '기하', '경제', '화학', '물리학', '물리', '생명과학', '지구과학',
    '세계사', '한국사', '환경', '논술', '정보', '체육', '음악', '미술',
    '일본어', '중국어', '창체', '자율', '동아리', '봉사', '진로'
  ];
  return knownSubjects.indexOf(s) !== -1;
}

/**
 * 선택과목이 아닌 학급 단위 일반/공통 교과인지 판별 (선택과목 오매칭 방지)
 */
function isNonElectiveRegularSubject_(subjectStr) {
  var b = stripElectiveGroupPrefix_(subjectStr)
    .replace(/\*+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .replace(/Ⅰ/g, '1')
    .replace(/Ⅱ/g, '2')
    .trim();
  if (!b) return false;
  var nonElectives = [
    '진로', '진로와직업', '진로활동',
    '확통', '확률과통계',
    '독서', '문학', '국어', '공통국어',
    '수학', '수학1', '수학2', '공통수학',
    '영어', '영어1', '영어2', '공통영어',
    '한국사', '통합사회', '통합과학', '과학탐구실험',
    '체육', '운동과건강', '운건', '스포츠생활', '스포츠',
    '창체', '창의적체험활동', '자율', '자율활동', '자치', '학급자치',
    '동아리', '동아리활동', '봉사', '봉사활동', '보강', '자습', '공강'
  ];
  return nonElectives.indexOf(b) !== -1;
}

/**
 * 선택과목 시트의 과목명과 시간표 셀의 과목명(약칭 포함) 매칭 여부 판정
 * - '진로'가 '진로영어'에 매칭되거나, '수학1'이 '심화수학1'에 매칭되는 오탐을 철저히 차단
 */
function isElectiveSubjectMatch_(electiveSubj, cellSubj) {
  var a = stripElectiveGroupPrefix_(electiveSubj)
    .replace(/\*+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[A-H][1-9]$/i, '')
    .replace(/\s+/g, '')
    .replace(/Ⅰ/g, '1')
    .replace(/Ⅱ/g, '2')
    .trim();
  var b = stripElectiveGroupPrefix_(cellSubj)
    .replace(/\*+/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[A-H][1-9]$/i, '')
    .replace(/\s+/g, '')
    .replace(/Ⅰ/g, '1')
    .replace(/Ⅱ/g, '2')
    .trim();
  if (!a || !b) return false;
  if (a === b) return true;

  // 일반/공통 과목('진로', '확통', '독서', '수학1', '영어' 등)은 선택과목 부분문자열/약칭 매칭에서 즉시 제외
  if (isNonElectiveRegularSubject_(b)) {
    return false;
  }

  // 과목 번호(1, 2)가 서로 다르면 불일치 (예: 화학1 vs 화학2)
  var numA = a.match(/([12])$/);
  var numB = b.match(/([12])$/);
  if (numA && numB && numA[1] !== numB[1]) {
    return false;
  }

  // 첫 글자가 같고 포함 관계이거나 순서대로 약칭(예: 영미문학읽기 <-> 영문, 생명과학2 <-> 생과2, 사회문제탐구 <-> 사문탐)인 경우만 인정
  if (a.charAt(0) !== b.charAt(0)) {
    return false;
  }
  if (a.indexOf(b) === 0 || b.indexOf(a) === 0) {
    return true;
  }

  if (b.length >= 2 && b.length <= a.length) {
    var searchPos = 0;
    var allInOrder = true;
    for (var i = 0; i < b.length; i++) {
      var foundIdx = a.indexOf(b.charAt(i), searchPos);
      if (foundIdx === -1) {
        allInOrder = false;
        break;
      }
      searchPos = foundIdx + 1;
    }
    if (allInOrder) return true;
  }

  return false;
}

/**
 * 특정 학년(2 또는 3)의 (요일 d, 교시 p) 슬롯에 명시된 선택과목 그룹 힌트(A_선택 등) 추출
 */
function detectExplicitElectiveHintForSlot_(store, grade, groupMap, d, p) {
  var classHintCounts = {};
  var teacherHintCounts = {};
  var regularClassCount = 0;

  for (var cNum = 1; cNum <= 9; cNum++) {
    var cKey = grade + '-' + cNum;
    var cObj = store.classes && store.classes[cKey];
    if (!cObj || !cObj.grid || !cObj.grid[p] || !cObj.grid[p][d]) continue;
    var slot = cObj.grid[p][d];
    if (!slot || (!slot.s && !slot.t)) continue;
    var hint = slot.eg || extractElectiveGroupHint_(slot.s);
    if (hint && groupMap[hint]) {
      classHintCounts[hint] = (classHintCounts[hint] || 0) + 1;
    } else if (isNonElectiveRegularSubject_(slot.s)) {
      regularClassCount++;
    }
  }

  var bestClassHint = '';
  var bestClassHintCnt = 0;
  for (var hk in classHintCounts) {
    if (classHintCounts[hk] > bestClassHintCnt) {
      bestClassHintCnt = classHintCounts[hk];
      bestClassHint = hk;
    }
  }
  if (bestClassHint && bestClassHintCnt >= 2 && regularClassCount <= 2) {
    return bestClassHint;
  }
  if (bestClassHint && bestClassHintCnt >= 1 && regularClassCount === 0) {
    return bestClassHint;
  }

  if (regularClassCount >= 2) {
    return '';
  }

  if (store.teachers) {
    var tKeys = Object.keys(store.teachers);
    for (var ti = 0; ti < tKeys.length; ti++) {
      var tObj = store.teachers[tKeys[ti]];
      var tSlot = tObj && tObj.grid && tObj.grid[p] ? tObj.grid[p][d] : null;
      if (!tSlot || !tSlot.s) continue;
      var targetCls = String(tSlot.c || '');
      if (targetCls.indexOf(grade + '-') === 0 || targetCls === grade + '학년') {
        var tHint = tSlot.eg || extractElectiveGroupHint_(tSlot.s);
        if (tHint && groupMap[tHint]) {
          teacherHintCounts[tHint] = (teacherHintCounts[tHint] || 0) + 1;
        }
      }
    }
  }

  var bestTHint = '';
  var bestTHintCnt = 0;
  for (var thk in teacherHintCounts) {
    if (teacherHintCounts[thk] > bestTHintCnt) {
      bestTHintCnt = teacherHintCounts[thk];
      bestTHint = thk;
    }
  }
  if (bestTHint && bestTHintCnt >= 3 && regularClassCount === 0) {
    return bestTHint;
  }

  return '';
}

/**
 * 특정 학년(2 또는 3)의 (요일 d, 교시 p) 슬롯이 어느 선택과목 그룹(A~F) 시간인지 자동 판별
 */
function detectElectiveGroupForGradeSlot_(store, grade, groupMap, d, p, explicitGroupSlotCounts) {
  if (!store || !groupMap) return '';
  var gKeys = Object.keys(groupMap);
  if (gKeys.length === 0) return '';

  // 1순위: 과목명에 A_선택, [A] 등 그룹 코드가 명시된 경우
  var explicitHint = detectExplicitElectiveHintForSlot_(store, grade, groupMap, d, p);
  if (explicitHint) {
    return explicitHint;
  }

  var classLessons = [];
  var regularSubjectClasses = 0;

  for (var cNum = 1; cNum <= 9; cNum++) {
    var cKey = grade + '-' + cNum;
    var cObj = store.classes && store.classes[cKey];
    if (!cObj || !cObj.grid || !cObj.grid[p] || !cObj.grid[p][d]) continue;
    var slot = cObj.grid[p][d];
    if (!slot || (!slot.s && !slot.t)) continue;
    var subjStr = String(slot.s || '').trim();
    if (isNonElectiveRegularSubject_(subjStr)) {
      regularSubjectClasses++;
    }
    classLessons.push({
      classKey: cKey,
      subject: subjStr,
      teacher: String(slot.t || '').trim(),
      hint: slot.eg || extractElectiveGroupHint_(subjStr)
    });
  }

  // 해당 교시에 해당 학년 학급들이 일반/공통 교과(진로, 확통, 독서, 체육, 창체 등)를 2학급 이상 수업 중이면 선택과목 시간이 아님
  if (regularSubjectClasses >= 2) {
    return '';
  }

  // 2순위: 명시적 그룹 힌트가 없는 그룹에 한해, (교사 + 선택과목명) 동시 일치 코스 수로 엄격 판정
  var bestGroup = '';
  var bestMatchedCourses = 0;
  var bestScore = 0;

  for (var gIdx = 0; gIdx < gKeys.length; gIdx++) {
    var gKey = gKeys[gIdx];
    // 이미 다른 교시에서 명시적 그룹 코드(예: B_선택)로 판별된 그룹은 일반 교시에서 추론으로 중복 배정하지 않음
    if (explicitGroupSlotCounts && explicitGroupSlotCounts[gKey] > 0) {
      continue;
    }

    var dayCourses = getElectiveGroupLessonsForDay_(groupMap[gKey], d);
    if (dayCourses.length === 0) continue;

    var matchedCourseCount = 0;
    var matchedClasses = {};
    var score = 0;

    for (var i = 0; i < dayCourses.length; i++) {
      var course = dayCourses[i];
      var cTeacher = course.teacher;
      var cSubj = course.subject;
      var courseMatched = false;

      // (a) 학급시간표에서 교사와 선택과목명이 동시에 일치하는지 확인 (교사만 일치하고 과목이 다른 일반 수업은 절대 점수 부여 금지)
      for (var clIdx = 0; clIdx < classLessons.length; clIdx++) {
        var cl = classLessons[clIdx];
        var tMatch =
          cTeacher &&
          cl.teacher &&
          (cl.teacher === cTeacher || cl.teacher.indexOf(cTeacher) !== -1);
        var sMatch = isElectiveSubjectMatch_(cSubj, cl.subject) || cl.hint === gKey;
        if (tMatch && sMatch) {
          score += 5;
          matchedClasses[cl.classKey] = true;
          courseMatched = true;
        }
      }

      // (b) 주간시간표(교사별 시간표)에서 해당 교사가 (d, p)에 해당 학년 대상으로 해당 선택과목을 수업 중인지 확인
      if (cTeacher && store.teachers && store.teachers[cTeacher]) {
        var tGrid = store.teachers[cTeacher].grid;
        var tLesson = tGrid && tGrid[p] ? tGrid[p][d] : null;
        if (tLesson) {
          var targetCls = String(tLesson.c || '');
          var isTargetGrade =
            targetCls.indexOf(grade + '-') === 0 || targetCls === grade + '학년';
          if (
            isTargetGrade &&
            (isElectiveSubjectMatch_(cSubj, tLesson.s) ||
              extractElectiveGroupHint_(tLesson.s) === gKey)
          ) {
            score += 4;
            courseMatched = true;
          }
        }
      }

      if (courseMatched) {
        matchedCourseCount++;
      }
    }

    // 학급시간표에 수업이 있는데 해당 그룹 코스와 일치하지 않는 다른 수업(일반 수업 등)이 3학급 이상이면 제외
    var nonMatchingClasses = 0;
    for (var k = 0; k < classLessons.length; k++) {
      if (!matchedClasses[classLessons[k].classKey] && classLessons[k].hint !== gKey) {
        nonMatchingClasses++;
      }
    }
    if (classLessons.length >= 4 && nonMatchingClasses >= 3) {
      continue;
    }

    var requiredCourses = Math.max(4, Math.ceil(dayCourses.length * 0.6));
    if (matchedCourseCount >= requiredCourses && score > bestScore) {
      bestScore = score;
      bestGroup = gKey;
      bestMatchedCourses = matchedCourseCount;
    }
  }

  if (bestGroup && bestMatchedCourses >= 4) {
    return bestGroup;
  }

  return '';
}

/**
 * 파싱된 학년별 선택과목 그룹 맵(groupMap)을 사용하여
 * 해당 학년(2학년 또는 3학년)의 선택과목 교시마다 실제 강의실(교실)-교과명-교사명을 정확히 매핑
 */
function applyElectiveClassroomMapping_(store, grade, groupMap) {
  if (!store || !groupMap) return;
  var gKeys = Object.keys(groupMap);
  if (gKeys.length === 0) return;

  var gNum = Number(grade) === 3 ? 3 : 2;
  if (!store.gradeSpecialRooms) {
    store.gradeSpecialRooms = { 2: {}, 3: {} };
  }
  if (!store.gradeSpecialRooms[gNum]) {
    store.gradeSpecialRooms[gNum] = {};
  }

  var maxP = store.maxPeriod || 7;

  // 사전 스캔: 학급/주간시간표에 명시적 그룹 힌트(A_선택 ~ F_선택 등)가 존재하는 그룹 파악
  var explicitGroupSlotCounts = {};
  for (var sd = 0; sd < 5; sd++) {
    for (var sp = 0; sp < maxP; sp++) {
      var expGrp = detectExplicitElectiveHintForSlot_(store, gNum, groupMap, sd, sp);
      if (expGrp) {
        explicitGroupSlotCounts[expGrp] = (explicitGroupSlotCounts[expGrp] || 0) + 1;
      }
    }
  }

  for (var d = 0; d < 5; d++) {
    for (var p = 0; p < maxP; p++) {
      var detectedGroup = detectElectiveGroupForGradeSlot_(
        store,
        gNum,
        groupMap,
        d,
        p,
        explicitGroupSlotCounts
      );
      if (!detectedGroup || !groupMap[detectedGroup]) continue;

      var dayLessons = getElectiveGroupLessonsForDay_(groupMap[detectedGroup], d);
      if (dayLessons.length === 0) continue;

      // 1. 해당 학년 기본 학급(2-1~2-9 또는 3-1~3-9) 및 가상 학급(10반 이상)의 (p, d) 슬롯 초기화
      for (var cNum = 1; cNum <= 25; cNum++) {
        var baseKey = gNum + '-' + cNum;
        if (cNum <= 9 || store.classes[baseKey]) {
          var baseEntity = ensureClassEntity_(store, baseKey, '');
          ensureGridRowSize_(baseEntity.grid, maxP);
          baseEntity.grid[p][d] = null;
        }
      }

      // 1-b. 해당 그룹 전체 교사 중 기존에 (p, d)에서 해당 학년(2-* / 3-*)으로 잘못 배정되어 있던 슬롯 초기화 (요일 분리 수업 교사 정합성 보장)
      var allGroupCourses = groupMap[detectedGroup] || [];
      for (var gcIdx = 0; gcIdx < allGroupCourses.length; gcIdx++) {
        var gTeacher = allGroupCourses[gcIdx].teacher;
        if (gTeacher && store.teachers[gTeacher] && store.teachers[gTeacher].grid[p]) {
          var prevTSlot = store.teachers[gTeacher].grid[p][d];
          if (
            prevTSlot &&
            (String(prevTSlot.c || '').indexOf(gNum + '-') === 0 ||
              isElectiveSubjectMatch_(allGroupCourses[gcIdx].subject, prevTSlot.s) ||
              extractElectiveGroupHint_(prevTSlot.s) === detectedGroup)
          ) {
            store.teachers[gTeacher].grid[p][d] = null;
          }
        }
      }

      // 2. 선택과목 시트에 정의된 각 강의실(교실)로 과목명·교사명·그룹코드(eg) 정확히 배치
      for (var i = 0; i < dayLessons.length; i++) {
        var item = dayLessons[i];
        var roomInfo = mapElectiveRoomToGradeClass_(gNum, item.room);
        if (!roomInfo.roomLabel) continue;

        var cleanSubjName = item.subject;
        var teacherDispSubj = '[' + detectedGroup + '] ' + item.subject;
        var tName = item.teacher;
        if (tName) store.hasTeacherInClassCells = true;

        if (!roomInfo.isSpecialRoom && roomInfo.classKey) {
          // 일반 학급 교실 (2학년: 301호~309호 -> 2-1~2-9, 3학년: 401호~409호 -> 3-1~3-9)
          var cEntity = ensureClassEntity_(store, roomInfo.classKey, '');
          cEntity.room = roomInfo.roomLabel;
          ensureGridRowSize_(cEntity.grid, maxP);
          cEntity.grid[p][d] = {
            s: cleanSubjName,
            t: tName,
            c: roomInfo.classKey,
            r: roomInfo.roomLabel,
            m: 0,
            cc: 0,
            st: '',
            eg: detectedGroup
          };
        } else {
          // 특별실/이동교실 (211호, 416호, 315호, 정보실 등)
          var spRoom = roomInfo.roomLabel;
          var spClassKey = gNum + '-' + spRoom;
          if (!store.gradeSpecialRooms[gNum][spRoom]) {
            store.gradeSpecialRooms[gNum][spRoom] = {
              key: spClassKey,
              label: spRoom,
              room: spRoom,
              grade: gNum,
              isSpecialRoom: true,
              grid: createEmptyGrid_(maxP, 5)
            };
          }
          var spEntity = store.gradeSpecialRooms[gNum][spRoom];
          ensureGridRowSize_(spEntity.grid, maxP);
          spEntity.grid[p][d] = {
            s: cleanSubjName,
            t: tName,
            c: spClassKey,
            r: spRoom,
            m: 0,
            cc: 0,
            st: '',
            eg: detectedGroup
          };
        }

        // 3. 담당 교사의 주간시간표(store.teachers) 슬롯도 실제 강의실·과목으로 동기화
        if (tName) {
          var tEntity = ensureTeacherEntity_(store, tName, item.subject, '');
          if (tEntity) {
            ensureGridRowSize_(tEntity.grid, maxP);
            var isDesignatedSpecial =
              roomInfo.isSpecialRoom &&
              isDesignatedGradeSpecialRoom_(gNum, roomInfo.roomLabel);
            var tTargetClass =
              !roomInfo.isSpecialRoom && roomInfo.classKey
                ? roomInfo.classKey
                : isDesignatedSpecial
                ? gNum + '-' + roomInfo.roomLabel
                : gNum + '학년';
            tEntity.grid[p][d] = {
              s: teacherDispSubj,
              t: tEntity.key,
              c: tTargetClass,
              r: roomInfo.roomLabel,
              m: 0,
              cc: 0,
              st: '',
              eg: detectedGroup
            };
          }
        }
      }
    }
  }
}

var GRADE_DESIGNATED_SPECIAL_ROOMS = {
  2: ['211호', '416호', '정보실'],
  3: ['211호', '315호', '정보실']
};

function isDesignatedGradeSpecialRoom_(grade, roomLabel) {
  var list = GRADE_DESIGNATED_SPECIAL_ROOMS[grade] || [];
  return list.indexOf(String(roomLabel || '').trim()) !== -1;
}

/**
 * 존재하지 않는 가상 학급(2학년 10반·11반, 3학년 10반·12반 등 10반 이상)을 제거하고,
 * 2학년('211호', '416호', '정보실') 및 3학년('211호', '315호', '정보실') 이동교실을
 * store.classes에 정식 엔티티로 등록하여 학급 시간표 및 수업 교사 모달에 일관되게 표시합니다.
 */
function finalizeSpecialRoomsAndCleanupVirtualClasses_(store) {
  if (!store || !store.classes) return;
  var maxP = store.maxPeriod || 7;
  if (!store.gradeSpecialRooms) {
    store.gradeSpecialRooms = { 2: {}, 3: {} };
  }

  var hasGrade = { 2: false, 3: false };
  Object.keys(store.classes).forEach(function (ck) {
    var cObj = store.classes[ck];
    if (!cObj) return;
    if (cObj.grade === 2) hasGrade[2] = true;
    if (cObj.grade === 3) hasGrade[3] = true;
  });

  // 선택과목 시트가 아직 업로드되지 않은 상태에서 가상 학급(10반~12반)이 존재하는 경우,
  // 해당 가상 학급의 수업 슬롯을 학년별 지정 특별실(211호, 416호/315호, 정보실)로 안전하게 이관
  [2, 3].forEach(function (gNum) {
    if (!store.gradeSpecialRooms[gNum]) {
      store.gradeSpecialRooms[gNum] = {};
    }
    var roomList = GRADE_DESIGNATED_SPECIAL_ROOMS[gNum] || [];
    var hasElectiveSpecialData = Object.keys(store.gradeSpecialRooms[gNum]).length > 0;

    if (!hasElectiveSpecialData) {
      var virtualKeys = Object.keys(store.classes)
        .filter(function (ck) {
          var cObj = store.classes[ck];
          return cObj && !cObj.isSpecialRoom && cObj.grade === gNum && cObj.classNo >= 10;
        })
        .sort(function (a, b) {
          return (store.classes[a].classNo || 99) - (store.classes[b].classNo || 99);
        });

      for (var vIdx = 0; vIdx < virtualKeys.length && vIdx < roomList.length; vIdx++) {
        var vObj = store.classes[virtualKeys[vIdx]];
        var targetRoomName = roomList[vIdx];
        var spClassKey = gNum + '-' + targetRoomName;
        var spGrid = createEmptyGrid_(maxP, 5);
        for (var p = 0; p < maxP; p++) {
          for (var d = 0; d < 5; d++) {
            var vSlot = vObj.grid && vObj.grid[p] ? vObj.grid[p][d] : null;
            if (vSlot && (vSlot.s || vSlot.t)) {
              var egHint = vSlot.eg || extractElectiveGroupHint_(vSlot.s || '');
              spGrid[p][d] = {
                s: stripElectiveGroupPrefix_(vSlot.s || ''),
                t: vSlot.t || '',
                c: spClassKey,
                r: targetRoomName,
                m: vSlot.m || 0,
                cc: vSlot.cc || 0,
                st: vSlot.st || '',
                eg: egHint
              };
            }
          }
        }
        store.gradeSpecialRooms[gNum][targetRoomName] = {
          key: spClassKey,
          label: targetRoomName,
          room: targetRoomName,
          grade: gNum,
          isSpecialRoom: true,
          grid: spGrid
        };
      }
    }
  });

  // 10반 이상 가상 학급(2-10, 2-11, 3-10, 3-12 등)을 store.classes에서 완전 삭제
  Object.keys(store.classes).forEach(function (ck) {
    var cObj = store.classes[ck];
    if (!cObj || cObj.isSpecialRoom) return;
    if (
      (typeof cObj.classNo === 'number' && cObj.classNo >= 10 && cObj.classNo < 99) ||
      /^[1-6]-(?:1\d|2\d)$/.test(ck)
    ) {
      delete store.classes[ck];
    }
  });

  // 2학년(211호, 416호, 정보실) 및 3학년(211호, 315호, 정보실) 특별실을 store.classes에 등록
  [2, 3].forEach(function (gNum) {
    if (!hasGrade[gNum]) return;
    var roomList = GRADE_DESIGNATED_SPECIAL_ROOMS[gNum] || [];
    for (var i = 0; i < roomList.length; i++) {
      var roomName = roomList[i];
      var specialKey = gNum + '-' + roomName;
      var spSource =
        store.gradeSpecialRooms[gNum] && store.gradeSpecialRooms[gNum][roomName]
          ? store.gradeSpecialRooms[gNum][roomName]
          : null;
      var grid = spSource && spSource.grid ? spSource.grid : createEmptyGrid_(maxP, 5);
      ensureGridRowSize_(grid, maxP);

      for (var p = 0; p < maxP; p++) {
        for (var d = 0; d < 5; d++) {
          if (grid[p] && grid[p][d]) {
            grid[p][d].c = specialKey;
            grid[p][d].r = roomName;
          }
        }
      }

      store.classes[specialKey] = {
        key: specialKey,
        label: roomName,
        grade: gNum,
        classNo: 10 + i,
        room: roomName,
        homeroom: '',
        isSpecialRoom: true,
        grid: grid
      };

      store.gradeSpecialRooms[gNum][roomName] = {
        key: specialKey,
        label: roomName,
        room: roomName,
        grade: gNum,
        isSpecialRoom: true,
        grid: grid
      };
    }
  });

  // 교사 시간표(store.teachers)에서 삭제된 가상 학급(2-10, 2-11, 3-10, 3-12 등)을 가리키던 슬롯 정리
  if (store.teachers) {
    Object.keys(store.teachers).forEach(function (tk) {
      var tObj = store.teachers[tk];
      if (!tObj || !tObj.grid) return;
      for (var p = 0; p < tObj.grid.length; p++) {
        if (!tObj.grid[p]) continue;
        for (var d = 0; d < 5; d++) {
          var tSlot = tObj.grid[p][d];
          if (!tSlot || !tSlot.c) continue;
          if (!store.classes[tSlot.c]) {
            var mVirt = String(tSlot.c).match(/^([23])-(?:1\d|2\d)$/);
            if (mVirt) {
              var gNum = parseInt(mVirt[1], 10);
              var normR = normalizeElectiveRoomName_(tSlot.r || '');
              var candidateKey = normR ? gNum + '-' + normR : '';
              if (candidateKey && store.classes[candidateKey]) {
                tSlot.c = candidateKey;
              } else {
                tSlot.c = gNum + '학년';
              }
            }
          }
        }
      }
    });
  }
}


