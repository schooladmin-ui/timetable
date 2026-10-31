/**
 * 초고속 교사 개인 및 학급 시간표 검색 웹앱 (Google Apps Script)
 * - 하드코딩 샘플 데이터 완전 제거 버전
 * - 오직 스프레드시트의 '주간시간표' 시트와 '학급시간표' 시트 데이터만 파싱하여 동작합니다.
 */

var CACHE_KEY_TIMETABLE = 'TIMETABLE_REAL_SHEETS_V3';
var CACHE_KEY_PREFIX = 'TT_FAST_V4_';
var CACHE_CHUNK_SIZE = 80000; // 단일 키 100KB 제한을 안전하게 회피하는 80KB 청크
var CACHE_TTL_SECONDS = 21600; // 6시간 캐싱
var PROP_VERSION_KEY = 'TIMETABLE_VERSION_HASH_V3';
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
    .setTitle('초고속 학급·교사 시간표 검색')
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

function computePayloadSignature_(classes, teachers, meta) {
  try {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.MD5,
      JSON.stringify({ c: classes, t: teachers, m: meta }),
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
    teachers: {}
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

  var allSheets = ss.getSheets();
  var allSheetNames = allSheets.map(function (s) {
    return s.getName();
  });

  var weeklySheet = findSheetByNameCandidates_(allSheets, allSheetNames, ['주간시간표', '주간 시간표', '교사시간표', '교사 시간표']);
  var classSheet = findSheetByNameCandidates_(allSheets, allSheetNames, ['학급시간표', '학급 시간표', '반별시간표', '반별 시간표']);

  if (!weeklySheet && !classSheet) {
    return buildEmptyErrorPayload_(
      '스프레드시트에서 [주간시간표] 또는 [학급시간표] 시트를 찾을 수 없습니다. 현재 시트 목록: [' +
        allSheetNames.join(', ') +
        ']',
      allSheetNames
    );
  }

  var meta = {
    schoolName: '',
    schoolYear: new Date().getFullYear() + '학년도',
    semester: '시간표',
    slogan: '',
    weekRange: '',
    periodTimes: ['', '', '', '', '', '', '']
  };

  var store = {
    maxPeriod: 7,
    classes: {},
    teachers: {},
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

  // 3. 주간시간표 <-> 학급시간표 양방향 교차 매핑 (빠진 교사명/과목명/학급 시간표 상호 보완)
  crossEnrichTimetables_(store);

  var classCount = Object.keys(store.classes).length;
  var teacherCount = Object.keys(store.teachers).length;

  if (classCount === 0 && teacherCount === 0) {
    return buildEmptyErrorPayload_(
      '[주간시간표] 및 [학급시간표] 시트에서 유효한 시간표 데이터를 찾지 못했습니다. 시트 내 요일(월~금) 및 교시(1~7) 표 구조를 확인해 주세요.',
      allSheetNames
    );
  }

  // 4. 네트워크 전송 및 캐시 용량 최소화를 위해 빈 속성/중복 속성 경량화 (~60% 용량 절감)
  compactStoreForTransport_(store);

  var sig = computePayloadSignature_(store.classes, store.teachers, meta);

  return {
    ok: true,
    v: updateVersionTimestamp_(),
    sig: sig,
    sheetNames: allSheetNames,
    foundSheets: {
      weekly: weeklySheet ? weeklySheet.getName() : null,
      classSheet: classSheet ? classSheet.getName() : null
    },
    hasTeacherInClassCells: store.hasTeacherInClassCells,
    meta: meta,
    days: ['월', '화', '수', '목', '금'],
    maxPeriod: store.maxPeriod,
    classes: store.classes,
    teachers: store.teachers
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
        g[p][d] = compact;
      }
    }
  });
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
    for (var pr = blk.headerRow + 1; pr < Math.min(rows.length, blk.headerRow + 20); pr++) {
      // 다음 블록의 요일 헤더를 만나면 중단
      if (parseDayCell_(rows[pr][blk.dayCols[0]]) === 0 && parseDayCell_(rows[pr][blk.dayCols[1]]) === 1) {
        break;
      }

      var rawPeriodCell = blk.periodCol >= 0 ? String(rows[pr][blk.periodCol] || '').trim() : '';
      var pInfo = parsePeriodCell_(rawPeriodCell);

      if (pInfo) {
        lastPeriodIdx = pInfo.period - 1;
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
      } else if (lastPeriodIdx !== -1) {
        // 교시 셀이 시각(예: 08:20)이거나 병합된 빈 셀인 경우: 시간 추출 및 2행 구조 서브 텍스트 병합
        var timeMatch = rawPeriodCell.match(/(\d{1,2}:\d{2})/);
        if (timeMatch && !meta.periodTimes[lastPeriodIdx]) {
          meta.periodTimes[lastPeriodIdx] = timeMatch[1];
        }
        var targetEntity =
          role === 'class' ? store.classes[identity.key] : store.teachers[identity.key];
        if (targetEntity) {
          for (var d2 = 0; d2 < 5; d2++) {
            var subText = String(rows[pr][blk.dayCols[d2]] || '').trim();
            if (subText) {
              appendSecondLineToSlot_(targetEntity, lastPeriodIdx, d2, subText, role, store);
            }
          }
        }
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
      st: parsedC.st
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
            st: parsedC.st
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
      st: parsedM.st
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
          st: parsedM.st
        };
      }
    }
  } else {
    // 교사별 시간표 슬롯
    var tEntity = ensureTeacherEntity_(store, identity.key, identity.subject || '', identity.homeroomClass || '');
    if (!tEntity) return;
    var parsedT = parseTeacherCellContent_(clean, tEntity.subjectMain);
    if (!parsedT.s && !parsedT.c) return;

    ensureGridRowSize_(tEntity.grid, pIdx + 1);
    tEntity.grid[pIdx][dayIdx] = {
      s: parsedT.s || tEntity.subjectMain || parsedT.c,
      t: tEntity.key,
      c: parsedT.c,
      r: parsedT.r,
      m: parsedT.m,
      cc: parsedT.cc,
      st: parsedT.st
    };
  }
}

/**
 * 2행 병합 구조에서 두 번째 행의 텍스트(교사명 또는 과목명)를 직전 슬롯에 결합합니다.
 */
function appendSecondLineToSlot_(entity, pIdx, dayIdx, secondLineText, role, store) {
  if (!entity || !entity.grid[pIdx]) return;
  var existing = entity.grid[pIdx][dayIdx];
  var combinedRaw = existing ? existing.s + '\n' + secondLineText : secondLineText;

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
      st: parsed.st
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
            st: parsed.st
          };
        }
      }
    }
  } else {
    var parsedT = parseTeacherCellContent_(combinedRaw, entity.subjectMain || '');
    entity.grid[pIdx][dayIdx] = {
      s: parsedT.s || entity.subjectMain || parsedT.c,
      t: entity.key,
      c: parsedT.c,
      r: parsedT.r,
      m: parsedT.m,
      cc: parsedT.cc,
      st: parsedT.st
    };
  }
}

/**
 * 학급 시간표 셀 텍스트 파싱 (과목명, 담당교사, 부가 활동명 분리)
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

  if (lines.length >= 2) {
    subj = lines[0];
    var line2 = lines[1];
    if (/^\([^)]+\)$/.test(line2) && isActivityBracket_(line2)) {
      subj = subj + ' ' + line2;
      if (lines[2]) teacher = lines[2];
    } else {
      teacher = line2.replace(/^[(\[]|[)\]]$/g, '').trim();
      if (lines[2]) room = lines[2];
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

  if ( teacher ) {
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
    st: status
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
          if ((!tSlot.s || tSlot.s === tSlot.c) && cSlot.s) {
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
            st: cSlot.st || ''
          };
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
    store.classes[classKey] = {
      key: classKey,
      label: isNumericPair ? parts[0] + '학년 ' + parts[1] + '반' : classKey,
      grade: isNumericPair ? parseInt(parts[0], 10) : 99,
      classNo: isNumericPair ? parseInt(parts[1], 10) : 99,
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
 * 엄격한 학급 키 추출 ('1-1', '1학년 1반', '101'~'625', '1월 1일')
 */
function tryExtractClassKeyStrict_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';

  // "1학년 3반", "제 2 학년 3 반", "2-3", "2-3반"
  var m1 = s.match(/^(?:제\s*)?([1-6])\s*(?:학년|[-.])\s*([1-9]|1\d|2[0-5])\s*(?:반)?$/);
  if (m1) return parseInt(m1[1], 10) + '-' + parseInt(m1[2], 10);

  // "101", "203", "312반" (3자리 학년반 코드)
  var m2 = s.match(/^([1-6])(0[1-9]|1\d|2[0-5])\s*(?:반)?$/);
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
