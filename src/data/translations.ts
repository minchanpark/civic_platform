import { Language } from '../types';

export interface Translations {
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  reportBtn: string;
  mapBtn: string;
  categoriesTitle: string;
  catDisaster: string;
  catFacility: string;
  catRoad: string;
  catBuilding: string;
  catEnvironment: string;
  tabMyReports: string;
  tabCommunity: string;
  tabFaq: string;
  trackingTitle: string;
  trackingSubtitle: string;
  step1: string;
  step2: string;
  step3: string;
  statusUnresolved: string;
  statusProceeding: string;
  statusSolved: string;
  statusDenied: string;
  communityTitle: string;
  communitySubtitle: string;
  communityHeaderBadge: string;
  communitySortByVotes: string;
  communitySortByTime: string;
  communityFilterCategoryAll: string;
  communityUrgentBadge: string;
  communitySupportProgress: string;
  communityViewDetails: string;
  communityRankLabel: string;
  upvoteLabel: string;
  communityUpvotedBadge: string;
  caseNo: string;
  faqs: { q: string; a: string }[];
  langNames: { zh: string; en: string; ja: string; ko: string };
  
  // Nav
  navCitizen: string;
  navMap: string;
  navRegions: string;
  navReports: string;
  navSettings: string;
  navLangSelect: string;
  
  // Report Modal
  modalTitle: string;
  step1Title: string;
  step2Title: string;
  nextStepBtn: string;
  prevStepBtn: string;
  selectCityLabel: string;
  selectDistrictLabel: string;
  modalDragHint: string;
  modalPinPlacedHint: string;
  modalConfirmLocationBtn: string;
  modalLocationConfirmedBadge: string;
  modalUnlockLocationBtn: string;
  modalDetailLabel: string;
  modalDistrictLabel: string;
  modalDescPlaceholder: string;
  modalPhotoLabel: string;
  modalCancel: string;
  modalSubmit: string;
  alertEnterDesc: string;
  alertRequirePhoto: string;
  alertReportSubmitted: string;

  // Photo Source Modal & Buttons
  successTitle: string;
  successSubTitle: string;
  successCaseNo: string;
  successCloseBtn: string;
  successNewReportBtn: string;

  // Photo Source Modal & Buttons
  photoSourceTitle: string;
  photoCameraTitle: string;
  photoCameraDesc: string;
  photoDeviceTitle: string;
  photoDeviceDesc: string;
  photoSampleTitle: string;
  photoSampleDesc: string;
  photoDirectCamera: string;
  photoFromDevice: string;
  photoAddBtn: string;
  photoSourceClose: string;
  cameraViewfinderTitle: string;
  cameraShutterBtn: string;
  cameraSwitchBtn: string;
  cameraErrorText: string;
  
  // Map View
  mapTotal: string;
  mapUnresolved: string;
  mapInProgress: string;
  mapSolved: string;
  mapSearchPlaceholder: string;
  mapViewDetails: string;
  
  // Reports List View
  reportsTitle: string;
  reportsSubtitle: string;
  reportsNewBtn: string;
  filterAll: string;
  reportsSearchPlaceholder: string;
  noReportsFound: string;
  updateStatusLabel: string;
  
  // Photo Pin
  photoPinTitle: string;
  photoPinHint: string;
  photoPinAddBtn: string;
  photoPinPlaceholder: string;
  photoPinRemove: string;
  photoPinCount: string;
  noNote: string;

  // Regions View
  regionsTitle: string;
  regionsSubtitle: string;
}

export const TRANSLATIONS: Record<Language, Translations> = {
  zh: {
    badge: 'CivicMap 市民服務專區',
    heroTitle: '全民即時通報，守護生活環境',
    heroSubtitle: '發現道路坑洞、路燈故障、環境髒亂或公共設施損壞？開啟 GPS 拍照通報，直通縣市政府權責單位快速派工處置！',
    reportBtn: '通報問題案件 (Report Issue)',
    mapBtn: '查看周邊即時地圖',
    categoriesTitle: '通報案件常見類型 (Quick Categories)',
    catDisaster: '災害通報',
    catFacility: '設施損壞',
    catRoad: '道路坑洞',
    catBuilding: '建物毀損',
    catEnvironment: '環境髒亂',
    tabMyReports: '我的通報紀錄',
    tabCommunity: '社區熱門關注議題',
    tabFaq: '通報常見問答 (FAQ)',
    trackingTitle: '即時處理進度追蹤',
    trackingSubtitle: '即時同步縣市政府派工系統',
    step1: '1. 市民提交',
    step2: '2. 權責單位派工',
    step3: '3. 現場修復結案',
    statusUnresolved: '未處理',
    statusProceeding: '處理中',
    statusSolved: '已解決',
    statusDenied: '已退回',
    communityTitle: '社區民眾關切議題與集氣榜',
    communitySubtitle: '全民連署支持數較高之案件，將自動提昇縣市政府派工急件處置優先級',
    communityHeaderBadge: '🔥 全民熱門集氣榜',
    communitySortByVotes: '依關注熱度 (Top Voted)',
    communitySortByTime: '依最新通報 (Newest)',
    communityFilterCategoryAll: '全部通報類別',
    communityUrgentBadge: '⚡ 優先處置案件',
    communitySupportProgress: '集氣目標進度 (達 50 票升級急件)',
    communityViewDetails: '查看照片標註詳情',
    communityRankLabel: '熱門排行',
    upvoteLabel: '集氣支持',
    communityUpvotedBadge: '已集氣支持',
    caseNo: '案號：',
    faqs: [
      {
        q: '通報後多久會收到權責單位處置回應？',
        a: '緊急災害通報（如嚴重落石、人行道塌陷）系統將於 2 小時內緊急交辦；一般設施毀損或環境清潔通報平均處理時間為 1 至 3 個工作天。',
      },
      {
        q: '上傳照片有格式或限制嗎？',
        a: '支援手持智慧型手機拍攝之 JPG、PNG 照片，建議開啟 GPS 定位功能，系統將自動比對座標精準定位。',
      },
      {
        q: '通報個人資料會被公開嗎？',
        a: '不會。本平台嚴格遵循個人資料保護法，公開資訊僅包含案件位置、照片與處置進度，通報人個人資料全程保密。',
      },
    ],
    langNames: {
      zh: '繁體中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
    },
    navCitizen: '市民專區',
    navMap: '即時地圖',
    navRegions: '行政區劃',
    navReports: '案件列表',
    navSettings: '系統設定',
    navLangSelect: '選擇語言 / Language',
    modalTitle: '告訴我們發生了什麼問題',
    step1Title: '步驟 1：選擇縣市與行政區域',
    step2Title: '步驟 2：發生什麼問題？',
    nextStepBtn: '下一步：填寫問題內容 →',
    prevStepBtn: '← 上一步：重新選擇地點',
    selectCityLabel: '選擇縣市',
    selectDistrictLabel: '選擇行政區',
    modalDragHint: '點擊地圖以放置通報 Pin 針',
    modalPinPlacedHint: '已標記位置 📍 (點擊或拖曳可調整)',
    modalConfirmLocationBtn: '確定通報位置',
    modalLocationConfirmedBadge: '位置已確定',
    modalUnlockLocationBtn: '重新選擇位置',
    modalDetailLabel: '詳細描述',
    modalDistrictLabel: '行政區',
    modalDescPlaceholder: '請描述您所見的情況...',
    modalPhotoLabel: '上傳現場照片 (必填)',
    modalCancel: '取消',
    modalSubmit: '送出通報 (Submit)',
    alertEnterDesc: '請填寫案件詳細描述',
    alertRequirePhoto: '請至少上傳 1 張現場照片',
    alertReportSubmitted: '通報已成功送出！案件編號：',
    successTitle: '通報已成功送出！',
    successSubTitle: '您的通報案件已順利成案，系統已派發至權責機關進行後續處置。',
    successCaseNo: '案件編號',
    successCloseBtn: '確定 / 關閉',
    successNewReportBtn: '繼續通報其他案件',
    photoSourceTitle: '選擇照片來源',
    photoCameraTitle: '開啟相機直接拍照',
    photoCameraDesc: '啟動手機/裝置相機鏡頭實地拍攝',
    photoDeviceTitle: '從裝置選擇照片',
    photoDeviceDesc: '挑選手機相簿或電腦中的圖檔',
    photoSampleTitle: '使用範例圖檔 (測試用)',
    photoSampleDesc: '快速帶入現場道路測試示意圖',
    photoDirectCamera: '直接拍照',
    photoFromDevice: '從裝置選擇',
    photoAddBtn: '新增',
    photoSourceClose: '取消',
    cameraViewfinderTitle: '即時相機取景器',
    cameraShutterBtn: '拍攝照片',
    cameraSwitchBtn: '切換鏡頭',
    cameraErrorText: '無法存取相機，請確認權限或改從裝置選擇圖檔。',
    mapTotal: '總通報案件',
    mapUnresolved: '待處理',
    mapInProgress: '處理中',
    mapSolved: '已解決',
    mapSearchPlaceholder: '搜尋地點或通報描述...',
    mapViewDetails: '查看詳細案件資料',
    reportsTitle: '市民回報 / 案件列表',
    reportsSubtitle: '檢視全民通報之環境、道路與設施案件處置進度。',
    reportsNewBtn: '通報新案件',
    filterAll: '全部案件',
    reportsSearchPlaceholder: '搜尋關鍵字或行政區...',
    noReportsFound: '尚無符合條件的通報案件。',
    updateStatusLabel: '更新狀態:',
    photoPinTitle: '照片特徵標註 (Photo Pin Annotation)',
    photoPinHint: '點擊照片任意位置即可新增標記點(Pin)，並可在文字框填寫該點具體狀況。',
    photoPinAddBtn: '點擊照片新增標點',
    photoPinPlaceholder: '輸入此標記點說明 (如：坑洞深約5cm)...',
    photoPinRemove: '刪除標點',
    photoPinCount: '已標註 Pin 點數：',
    noNote: '(未填寫說明)',
    regionsTitle: '選擇地區',
    regionsSubtitle: '請選擇您要查看或通報問題的縣市區域。',
  },
  en: {
    badge: 'CivicMap Citizen Portal',
    heroTitle: 'Real-Time Civic Reporting for a Better City',
    heroSubtitle: 'Spotted a pothole, broken streetlight, litter, or damaged public property? Take a photo with GPS to directly notify local government agencies for quick dispatch!',
    reportBtn: 'Report an Issue Now',
    mapBtn: 'View Nearby Live Map',
    categoriesTitle: 'Report Issue Categories (Quick Categories)',
    catDisaster: 'Disaster',
    catFacility: 'Facility Issue',
    catRoad: 'Road Damage',
    catBuilding: 'Building Damage',
    catEnvironment: 'Environmental Issue',
    tabMyReports: 'My Reports History',
    tabCommunity: 'Community Hot Topics',
    tabFaq: 'Report FAQ',
    trackingTitle: 'Live Dispatch Progress Tracker',
    trackingSubtitle: 'Synchronized live with municipal dispatch systems',
    step1: '1. Submitted',
    step2: '2. Dispatched',
    step3: '3. Resolved & Fixed',
    statusUnresolved: 'Unresolved',
    statusProceeding: 'In Progress',
    statusSolved: 'Solved',
    statusDenied: 'Denied',
    communityTitle: 'Community Concerns & Public Upvote Board',
    communitySubtitle: 'Issues with high community support will be automatically prioritized for emergency dispatch',
    communityHeaderBadge: '🔥 Community Leaderboard',
    communitySortByVotes: 'Top Voted',
    communitySortByTime: 'Newest First',
    communityFilterCategoryAll: 'All Categories',
    communityUrgentBadge: '⚡ Priority Fast-Track',
    communitySupportProgress: 'Upvote Goal (50 votes upgrades repair priority)',
    communityViewDetails: 'View Photo Pin Details',
    communityRankLabel: 'Rank',
    upvoteLabel: 'Support',
    communityUpvotedBadge: 'Upvoted',
    caseNo: 'Case No: ',
    faqs: [
      {
        q: 'How long does it take for agencies to respond?',
        a: 'Emergency reports (landslides, pavement collapses) are dispatched within 2 hours. General repairs or sanitation requests take 1 to 3 business days.',
      },
      {
        q: 'Are there photo upload restrictions?',
        a: 'Supports standard JPG and PNG photos. Enabling GPS location service ensures coordinates are automatically accurate.',
      },
      {
        q: 'Will my personal information be visible publicly?',
        a: 'No. The platform complies strictly with privacy protection laws. Public view displays case location, photos, and status only.',
      },
    ],
    langNames: {
      zh: '繁體中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
    },
    navCitizen: 'Citizen Portal',
    navMap: 'Live Map',
    navRegions: 'Regions',
    navReports: 'Reports List',
    navSettings: 'System Settings',
    navLangSelect: 'Select Language',
    modalTitle: 'Tell us what happened',
    step1Title: 'Step 1: Select City & District Location',
    step2Title: 'Step 2: Describe the Issue',
    nextStepBtn: 'Next: What Happened? →',
    prevStepBtn: '← Back: Change Location',
    selectCityLabel: 'Select City / County',
    selectDistrictLabel: 'Select District',
    modalDragHint: 'Click on the map to place location pin',
    modalPinPlacedHint: 'Location Pin Placed 📍 (Click or drag to move)',
    modalConfirmLocationBtn: 'Confirm Location',
    modalLocationConfirmedBadge: 'Location Confirmed',
    modalUnlockLocationBtn: 'Change Location',
    modalDetailLabel: 'Detailed Description',
    modalDistrictLabel: 'District',
    modalDescPlaceholder: 'Please describe the situation you observed...',
    modalPhotoLabel: 'Upload Photo (Required)',
    modalCancel: 'Cancel',
    modalSubmit: 'Submit Report',
    alertEnterDesc: 'Please enter a detailed description of the issue.',
    alertRequirePhoto: 'Please attach at least 1 photo of the issue.',
    alertReportSubmitted: 'Report submitted successfully! Case ID: ',
    successTitle: 'Report Submitted Successfully!',
    successSubTitle: 'Your report has been received and routed to the relevant government agency for processing.',
    successCaseNo: 'Tracking No.',
    successCloseBtn: 'Done / Close',
    successNewReportBtn: 'Submit Another Report',
    photoSourceTitle: 'Choose Photo Source',
    photoCameraTitle: 'Take Photo with Camera',
    photoCameraDesc: 'Capture live photo using device camera',
    photoDeviceTitle: 'Choose from Device',
    photoDeviceDesc: 'Select photo from gallery or local files',
    photoSampleTitle: 'Use Sample Image (Testing)',
    photoSampleDesc: 'Load sample photo of road condition',
    photoDirectCamera: 'Camera',
    photoFromDevice: 'From Device',
    photoAddBtn: 'Add',
    photoSourceClose: 'Cancel',
    cameraViewfinderTitle: 'Live Camera Viewfinder',
    cameraShutterBtn: 'Take Photo',
    cameraSwitchBtn: 'Switch Camera',
    cameraErrorText: 'Cannot access camera. Please check camera permissions or select a photo file from your device.',
    mapTotal: 'TOTAL REPORTS',
    mapUnresolved: 'UNRESOLVED',
    mapInProgress: 'IN PROGRESS',
    mapSolved: 'SOLVED',
    mapSearchPlaceholder: 'Search location or description...',
    mapViewDetails: 'View Detailed Case Info',
    reportsTitle: 'Citizen Feedback / Reports List',
    reportsSubtitle: 'Track environmental, road, and facility reports submitted by citizens.',
    reportsNewBtn: 'New Report',
    filterAll: 'All Reports',
    reportsSearchPlaceholder: 'Search keyword or district...',
    noReportsFound: 'No reports found matching your search.',
    updateStatusLabel: 'Update Status:',
    photoPinTitle: 'Photo Pin Annotation',
    photoPinHint: 'Click anywhere on the photo to drop a pin marker, then enter details in the text box.',
    photoPinAddBtn: 'Click photo to place a pin',
    photoPinPlaceholder: 'Enter note for this pin point (e.g. 5cm deep pothole)...',
    photoPinRemove: 'Remove Pin',
    photoPinCount: 'Pins added: ',
    noNote: '(No note added)',
    regionsTitle: 'Select Region',
    regionsSubtitle: 'Choose a county or city region to view or report issues.',
  },
  ja: {
    badge: 'CivicMap 市民サービスポータル',
    heroTitle: 'リアルタイム通報で、安心で快適な街づくりを',
    heroSubtitle: '道路の凹凸、街灯故障、ゴミの放置、公共施設の不具合を発見しましたか？写真とGPSで速やかに自治体へ通報・迅速手配！',
    reportBtn: '今すぐ問題を報告 (Report Issue)',
    mapBtn: '周辺のリアルタイムマップを見る',
    categoriesTitle: '通報カテゴリー (Quick Categories)',
    catDisaster: '災害通報',
    catFacility: '施設破損',
    catRoad: '道路不具合',
    catBuilding: '建物破損',
    catEnvironment: '環境美化',
    tabMyReports: '私の通報履歴',
    tabCommunity: '地域の注目トピック',
    tabFaq: 'よくある質問 (FAQ)',
    trackingTitle: '対応状況リアルタイム追跡',
    trackingSubtitle: '自治体派遣システムとリアルタイム同期中',
    step1: '1. 市民通報受付',
    step2: '2. 担当部署へ手配',
    step3: '3. 現場修復・完了',
    statusUnresolved: '受付中',
    statusProceeding: '対応中',
    statusSolved: '解決済み',
    statusDenied: '却下',
    communityTitle: '地域の関心事と市民賛同ランキング',
    communitySubtitle: '賛同数の多い案件は自動的に自治体派遣の優先度が引き上げられます',
    communityHeaderBadge: '🔥 注目賛同ランキング',
    communitySortByVotes: '賛同数順',
    communitySortByTime: '新着順',
    communityFilterCategoryAll: 'すべてのカテゴリー',
    communityUrgentBadge: '⚡ 優先対応案件',
    communitySupportProgress: '賛同目標進捗 (50賛同で優先度が向上)',
    communityViewDetails: '写真注記の詳細を見る',
    communityRankLabel: '順位',
    upvoteLabel: '賛同する',
    communityUpvotedBadge: '賛同済み',
    caseNo: '案件番号：',
    faqs: [
      {
        q: '通報後、どのくらいで対応されますか？',
        a: '緊急災害（落石、歩道崩落など）は2時間以内に手配されます。一般的な補修や清掃依頼は平均1〜3営業日以内に処理されます。',
      },
      {
        q: '写真のフォーマットに制限はありますか？',
        a: 'スマートフォンで撮影したJPG、PNG形式に対応しています。GPS位置情報を有効にすると、正確な座標が自動設定されます。',
      },
      {
        q: '個人情報は公開されますか？',
        a: '公開されません。個人情報保護法に基づき、公開されるのは通報場所・写真・進捗状況のみで、通報者情報は非公開です。',
      },
    ],
    langNames: {
      zh: '繁體中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
    },
    navCitizen: '市民ポータル',
    navMap: 'リアルタイムマップ',
    navRegions: '行政区分',
    navReports: '通報一覧',
    navSettings: 'システム設定',
    navLangSelect: '言語を選択',
    modalTitle: '問題の内容を教えてください',
    step1Title: 'ステップ 1: 地域・行政区と位置を選択',
    step2Title: 'ステップ 2: どのような問題が発生しましたか？',
    nextStepBtn: '次へ: 問題内容を入力 →',
    prevStepBtn: '← 戻る: 場所を再選択',
    selectCityLabel: '都道府県を選択',
    selectDistrictLabel: '行政区を選択',
    modalDragHint: '地図をクリックして位置ピンを設置',
    modalPinPlacedHint: '位置ピン設置済み 📍 (クリック/ドラッグで移動)',
    modalConfirmLocationBtn: '通報位置を確定',
    modalLocationConfirmedBadge: '位置確定済み',
    modalUnlockLocationBtn: '位置を再選択',
    modalDetailLabel: '詳細説明',
    modalDistrictLabel: '行政区',
    modalDescPlaceholder: '状況の詳細を入力してください...',
    modalPhotoLabel: '現場写真をアップロード (必須)',
    modalCancel: 'キャンセル',
    modalSubmit: '通報送信 (Submit)',
    alertEnterDesc: '問題の詳細説明を入力してください。',
    alertRequirePhoto: '現場写真を少なくとも1枚添付してください。',
    alertReportSubmitted: '通報が正常に送信されました！ 案件番号：',
    successTitle: '通報が正常に完了しました！',
    successSubTitle: 'ご通報いただいた内容は担当機関に送信され、順次対応を進めてまいります。',
    successCaseNo: '受付番号',
    successCloseBtn: '確認 / 閉じる',
    successNewReportBtn: '続けて通報する',
    photoSourceTitle: '写真の選択方法',
    photoCameraTitle: 'カメラを起動して撮影',
    photoCameraDesc: '端末のカメラで現場の写真を撮影します',
    photoDeviceTitle: '端末から写真を選択',
    photoDeviceDesc: 'アルバムやフォルダ内の画像を選択します',
    photoSampleTitle: 'サンプル画像を使用 (テスト用)',
    photoSampleDesc: 'テスト用の現場補修サンプル画像を読み込みます',
    photoDirectCamera: 'カメラ',
    photoFromDevice: '端末から',
    photoAddBtn: '追加',
    photoSourceClose: 'キャンセル',
    cameraViewfinderTitle: 'ライブカメラファインダー',
    cameraShutterBtn: '写真を撮影',
    cameraSwitchBtn: 'カメラ切替',
    cameraErrorText: 'カメラにアクセスできません。権限を確認するか、端末から画像を選択してください。',
    mapTotal: '総通報数',
    mapUnresolved: '未対応',
    mapInProgress: '対応中',
    mapSolved: '解決済み',
    mapSearchPlaceholder: '場所や説明を検索...',
    mapViewDetails: '詳細情報を表示',
    reportsTitle: '市民からの通報 / 案件一覧',
    reportsSubtitle: '市民から寄せられた環境・道路・施設の対応状況を確認できます。',
    reportsNewBtn: '新規通報',
    filterAll: 'すべての案件',
    reportsSearchPlaceholder: 'キーワードまたは地域で検索...',
    noReportsFound: '該当する案件が見つかりません。',
    updateStatusLabel: 'ステータス更新:',
    photoPinTitle: '写真のピン留め・注記 (Photo Pin Annotation)',
    photoPinHint: '写真をクリックしてピンを追加し、テキストボックスに詳しい状況を入力できます。',
    photoPinAddBtn: '写真をクリックしてピンを追加',
    photoPinPlaceholder: 'この箇所の詳細を入力（例: 深さ約5cmの亀裂）...',
    photoPinRemove: 'ピンを削除',
    photoPinCount: '追加されたピン数: ',
    noNote: '(注記なし)',
    regionsTitle: '地域を選択',
    regionsSubtitle: '問題を確認・通報する都道府県・地域を選択してください。',
  },
  ko: {
    badge: 'CivicMap 시민 서비스 포털',
    heroTitle: '실시간 시민 신고로 만드는 깨끗한 우리 동네',
    heroSubtitle: '도로 파손, 가로등 고장, 쓰레기 방치, 공공시설 손상을 발견하셨나요? 사진과 GPS로 지자체 담당 부서에 즉시 신고하세요!',
    reportBtn: '지금 신고하기 (Report Issue)',
    mapBtn: '주변 실시간 지도 보기',
    categoriesTitle: '신고 주요 카테고리 (Quick Categories)',
    catDisaster: '재난 신고',
    catFacility: '시설물 손상',
    catRoad: '도로 파손',
    catBuilding: '건물 손상',
    catEnvironment: '환경 오염',
    tabMyReports: '내 신고 내역',
    tabCommunity: '지역 주민 주요 관심 이슈',
    tabFaq: '자주 묻는 질문 (FAQ)',
    trackingTitle: '실시간 처리 현황 추적',
    trackingSubtitle: '지자체 작업 배정 시스템 실시간 연동',
    step1: '1. 시민 접수',
    step2: '2. 담당 부서 배정',
    step3: '3. 현장 수리 완료',
    statusUnresolved: '접수대기',
    statusProceeding: '처리중',
    statusSolved: '해결됨',
    statusDenied: '반려됨',
    communityTitle: '지역 주민 관심 이슈 및 공감 랭킹 Board',
    communitySubtitle: '주민 공감 수가 높은 이슈는 지자체 보수 작업 우선순위가 자동으로 격상됩니다',
    communityHeaderBadge: '🔥 시민 공감 랭킹 Board',
    communitySortByVotes: '공감순',
    communitySortByTime: '최신순',
    communityFilterCategoryAll: '전체 카테고리',
    communityUrgentBadge: '⚡ 우선 긴급 처리 대상',
    communitySupportProgress: '공감 목표 진행도 (50표 달성 시 긴급 지원)',
    communityViewDetails: '사진 핀 상세 보기',
    communityRankLabel: '순위',
    upvoteLabel: '공감 지지',
    communityUpvotedBadge: '공감 완료',
    caseNo: '접수번호: ',
    faqs: [
      {
        q: '신고 후 처리까지 얼마나 걸리나요?',
        a: '긴급 재난 신고(낙석, 보도블록 침하)는 2시간 이내에 긴급 배정되며, 일반 시설물 정비는 영업일 기준 1~3일 소요됩니다.',
      },
      {
        q: '사진 업로드 시 제한 사항이 있나요?',
        a: '스마트폰으로 촬영한 JPG, PNG 사진을 지원합니다. GPS 위치 권한을 허용하시면 위치가 정밀하게 매칭됩니다.',
      },
      {
        q: '신고자 개인정보가 공개되나요?',
        a: '공개되지 않습니다. 개인정보 보호법에 따라 공개 화면에는 위치, 사진, 처리 경과만 표시되며 신고자 정보는 안전하게 보호됩니다.',
      },
    ],
    langNames: {
      zh: '繁體中文',
      en: 'English',
      ja: '日本語',
      ko: '한국어',
    },
    navCitizen: '시민 포털',
    navMap: '실시간 지도',
    navRegions: '행정 구역',
    navReports: '신고 목록',
    navSettings: '시스템 설정',
    navLangSelect: '언어 선택',
    modalTitle: '어떤 문제가 발생했나요?',
    step1Title: '1단계: 지역 및 행정구 선택',
    step2Title: '2단계: 어떤 문제가 발생했나요?',
    nextStepBtn: '다음: 문제 내용 작성 →',
    prevStepBtn: '← 이전: 위치 다시 선택',
    selectCityLabel: '시/도 선택',
    selectDistrictLabel: '행정구 선택',
    modalDragHint: '지도를 클릭하여 위치 핀을 찍어주세요',
    modalPinPlacedHint: '위치 핀 찍힘 📍 (클릭 또는 드래그하여 이동 가능)',
    modalConfirmLocationBtn: '신고 위치 확정',
    modalLocationConfirmedBadge: '위치 확정됨',
    modalUnlockLocationBtn: '위치 다시 선택',
    modalDetailLabel: '상세 설명',
    modalDistrictLabel: '행정구',
    modalDescPlaceholder: '상황에 대해 설명해 주세요...',
    modalPhotoLabel: '현장 사진 첨부 (필수)',
    modalCancel: '취소',
    modalSubmit: '신고 제출 (Submit)',
    alertEnterDesc: '문제 상황에 대한 상세 설명을 입력해 주세요.',
    alertRequirePhoto: '현장 사진을 최소 1장 이상 첨부해주세요.',
    alertReportSubmitted: '신고가 성공적으로 접수되었습니다! 접수번호: ',
    successTitle: '민원 접수가 완료되었습니다!',
    successSubTitle: '접수된 민원은 관할 담당 부서로 전달되어 신속하게 처리 및 점검될 예정입니다.',
    successCaseNo: '접수 번호',
    successCloseBtn: '확인 / 닫기',
    successNewReportBtn: '새 민원 추가 접수',
    photoSourceTitle: '사진 출처 선택',
    photoCameraTitle: '카메라로 직접 촬영',
    photoCameraDesc: '기기 카메라를 켜서 현장 사진을 촬영합니다',
    photoDeviceTitle: '기기에서 사진 선택',
    photoDeviceDesc: '앨범 또는 파일에서 기존 사진을 선택합니다',
    photoSampleTitle: '샘플 이미지 사용 (테스트용)',
    photoSampleDesc: '도로 테스트용 샘플 이미지를 불러옵니다',
    photoDirectCamera: '카메라',
    photoFromDevice: '기기에서',
    photoAddBtn: '추가',
    photoSourceClose: '취소',
    cameraViewfinderTitle: '실시간 카메라 촬영 (Live Viewfinder)',
    cameraShutterBtn: '사진 촬영',
    cameraSwitchBtn: '전/후면 전환',
    cameraErrorText: '카메라에 접근할 수 없습니다. 권한을 확인하거나 파일 선택을 이용해주세요.',
    mapTotal: '총 신고 건수',
    mapUnresolved: '접수대기',
    mapInProgress: '처리중',
    mapSolved: '해결됨',
    mapSearchPlaceholder: '위치 또는 설명 검색...',
    mapViewDetails: '상세 정보 보기',
    reportsTitle: '시민 신고 / 접수 목록',
    reportsSubtitle: '시민이 신고한 환경, 도로 및 시설물 처리 현황을 확인하세요.',
    reportsNewBtn: '새 신고 작성',
    filterAll: '전체 신고',
    reportsSearchPlaceholder: '키워드 또는 행정구 검색...',
    noReportsFound: '조건에 맞는 신고 내역이 없습니다.',
    updateStatusLabel: '상태 변경:',
    photoPinTitle: '사진 위치 핀 표시 및 설명 (Photo Pin Annotation)',
    photoPinHint: '사진을 클릭하여 핀을 추가하고 텍스트 상자에 상세 내용을 작성하세요.',
    photoPinAddBtn: '사진을 클릭하여 핀 추가',
    photoPinPlaceholder: '이 위치에 대한 설명 입력 (예: 약 5cm 파인 도로)...',
    photoPinRemove: '핀 삭제',
    photoPinCount: '추가된 핀 개수: ',
    noNote: '(설명 없음)',
    regionsTitle: '지역 선택',
    regionsSubtitle: '조회 또는 신고할 지역을 선택하세요.',
  },
};

export function getCategoryLabel(category: string, t: Translations): string {
  switch (category) {
    case 'Disaster':
      return t.catDisaster;
    case 'Facility issue':
      return t.catFacility;
    case 'Road damage':
      return t.catRoad;
    case 'Building damage':
      return t.catBuilding;
    case 'Environmental issue':
      return t.catEnvironment;
    default:
      return category;
  }
}

export function getStatusLabel(status: string, t: Translations): string {
  switch (status) {
    case 'Unresolved':
      return t.statusUnresolved;
    case 'Proceeding':
      return t.statusProceeding;
    case 'Solved':
      return t.statusSolved;
    case 'Denied':
      return t.statusDenied;
    default:
      return status;
  }
}

