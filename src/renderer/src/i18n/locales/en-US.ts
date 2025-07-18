export default {
  common: {
    appName: 'DeepLingo',
    translate: 'Translate',
    translating: 'Translating...',
    sourceLanguage: 'Source Language',
    targetLanguage: 'Target Language',
    swap: 'Swap Languages',
    copy: 'Copy',
    clear: 'Clear',
    save: 'Save',
    cancel: 'Cancel',
    success: 'Success',
    error: 'Error',
    loading: 'Loading...',
    settings: 'Settings',
    about: 'About',
    logs: 'Logs',
    results: 'Results',
    file: 'File',
    selectFile: 'Select File',
    status: 'Status',
    progress: 'Progress',
    completed: 'Completed',
    failed: 'Failed'
  },
  menu: {
    textTranslate: 'Text Translation',
    documentTranslate: 'Document Translation',
    videoTranslate: 'Video Translation',
    translateResults: 'Translation Results',
    logs: 'Translation Logs',
    settings: 'Settings',
    about: 'About',
    docxParser: 'Word Parser'
  },
  textTranslate: {
    sourceText: 'Source Text',
    translatedText: 'Translated Text',
    translateButton: 'Translate',
    clearButton: 'Clear',
    copyButton: 'Copy Result',
    emptySourceText: 'Please enter text to translate',
    translating: 'Translating...',
    translateFailed: 'Translation failed'
  },
  documentTranslate: {
    fileSettings: 'File Settings',
    documentFile: 'Document File',
    selectDocumentFile: 'Please select document file (supports Excel and Word formats)',
    excelFile: 'Excel File',
    selectExcelFile: 'Please select Excel file',
    referenceSettings: 'Reference Settings',
    noReference: 'No Reference',
    internalReference: 'Use Internal Reference',
    externalReference: 'Use External Reference',
    selectRefLanguage: 'Select Reference Language',
    selectRefFile: 'Please select reference Excel file',
    languageSettings: 'Language Settings',
    sourceLanguage: 'Source Language:',
    targetLanguages: 'Target Languages:',
    startTranslate: 'Start Translation',
    runningLogs: 'Running Logs',
    noLogs: 'No logs available',
    translating: 'Translating...',
    selectFile: 'Select File',
    emptyFile: 'Please select the document file to translate',
    emptyTarget: 'Please select target languages',
    emptySource: 'Please select source language',
    emptyRefLang: 'Please select reference language column',
    emptyRefFile: 'Please select reference Excel file',
    wordNoReference: 'Word documents do not support reference settings, please select "No Reference"',
    translateFailed: 'Translation failed: {error}',
    saveSuccess: 'Translation results saved',
    saveFailed: 'Failed to save translation results: {error}',
    logStart: 'Start translation: {file}',
    logSourceLang: 'Source language: {lang}',
    logTargetLang: 'Target language: {lang}',
    logTranslating: 'Translating row {row} to {lang}, progress: {current}/{total}',
    logRowDone: 'Completed all language translations for row {row}/{total}',
    logSaved: 'All translation results saved to: {path}',
    logAllDone: 'Translation task completed!',
    logError: 'Translation error: {error}',
    selectedFile: 'Selected file: {file}',
    translatingTo: 'Translating to {lang}...',
    allCompleted: 'All translations completed!',
    logSavedLang: '{lang} version saved: {path}',
    selectTargetLanguage: 'Select target language'
  },
  videoTranslate: {
    subtitleFile: 'Subtitle File',
    selectSubtitleFile: 'Please select subtitle file',
    selectFile: 'Select File',
    languageSettings: 'Language Settings',
    sourceSubtitles: 'Source Subtitles',
    translatedSubtitles: 'Translated Subtitles',
    subtitleCount: '{count} subtitles in total',
    translatedCount: 'Translated {translated}/{total}',
    sourcePlaceholder: 'Source subtitles will be shown here',
    translatedPlaceholder: 'Translation results will be shown here',
    startTranslate: 'Start Translation',
    translating: 'Translating...',
    preview: 'Preview',
    statusReady: 'Ready to start translation...',
    statusTranslating: 'Translating {current}/{total}',
    statusCompleted: 'Translation completed! Subtitle file saved: {outputPath}',
    statusFailed: 'Translation failed: {error}',
    statusLoaded: '{count} subtitles loaded',
    batchTranslateMismatch: 'Batch translation mismatch, switching to line-by-line ({got} vs {expected})',
    batchTranslateFailed: 'Batch translation failed, switching to line-by-line',
    singleTranslateFailed: 'Single line translation failed {count} times, skipping this line',
    tooManyFailures: 'Too many translation failures, please check your network or try again later',
    noSubtitles: 'No subtitles available',
    fileNotFound: 'Subtitle file not found',
    saveSuccess: 'Subtitle saved successfully',
    saveFailed: 'Failed to save subtitle: {error}',
    translationComplete: 'Translation completed!',
    loadedSubtitles: '{count} subtitles loaded',
    translatingSingle: 'Translating subtitle {current} of {total}'
  },
  settings: {
    title: 'Settings',
    apiSettings: 'DeepSeek API Settings',
    apiKey: 'API Key',
    apiKeyHint: 'Note: Please ensure your API Key has sufficient balance. Translation will fail if the balance is insufficient.',
    checkBalance: 'Check Balance',
    balanceInfo: 'Current Balance: {credits}',
    modelSettings: 'Model Settings',
    selectModel: 'Select Model',
    modelHint: 'DeepSeek Reasoner model provides higher translation quality but consumes more API credits. Recommended for important documents.',
    ollamaSettings: 'Ollama Local AI Settings',
    useOllama: 'Use Ollama Local AI',
    ollamaHint: 'When enabled, translations will use local Ollama service without requiring an API Key. Ollama must be installed and running.',
    ollamaUrl: 'Ollama Service URL',
    testConnection: 'Test Connection',
    selectModelName: 'Select Model Name',
    selectModelParam: 'Select Parameter Size',
    currentModel: 'Current selected model: {model}',
    refreshModelList: 'Refresh Model List',
    modelNote: 'Note: First-time use requires downloading the model via Ollama, e.g.: ollama pull deepseek-r1:7b',
    modelDescription: 'Model Description:',
    themeSettings: 'Theme Settings',
    followSystem: 'Follow System',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    languageSettings: 'Language Settings',
    language: 'Interface Language',
    storageSettings: 'Storage Settings',
    storageLocation: 'Storage Location',
    translateSettings: 'Translation Parameters',
    concurrentThreads: 'Concurrent Threads',
    batchSize: 'Batch Size',
    maxRetries: 'Max Retries',
    saveInterval: 'Save Interval',
    progressInterval: 'Progress Display Interval',
    subtitleSettings: 'Subtitle Translation Settings',
    subtitleBatchSize: 'Subtitle Batch Size',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved successfully',
    settingsSaveFailed: 'Failed to save settings: {error}',
    deepseekChat: 'DeepSeek Chat',
    deepseekReasoner: 'DeepSeek Reasoner',
    connectionSuccess: 'Connection successful! Model is available.',
    ollamaConnectionSuccess: 'Ollama connection test successful, detected {count} local models',
    successLoadRemoteModels: 'Successfully loaded {count} remote models',
    successLoadModels: 'Successfully loaded {count} models',
    modelLoadFailed: 'Model loading failed',
    ollamaUrlHint: 'e.g.: http://localhost:11434',
    selectModelNameHint: 'Select model name first',
    selectModelParamHint: 'Then select parameter size',
    modelQ4: 'Q4: Minimum memory usage, suitable for low-end devices',
    modelQ8: 'Q8: Balanced performance and memory usage',
    modelFP16: 'FP16: Highest precision, requires more memory',
    modelStronger: 'The larger the number, the stronger the model, but more resources are required',
    modelLocalFirst: 'Locally installed models are displayed at the top of the list',
    concurrentThreadsHint: 'Recommended: 1-10, default: 5',
    batchSizeHint: 'Recommended: 5-20, default: 10',
    maxRetriesHint: 'Recommended: 1-5, default: 3',
    saveIntervalHint: 'Save after processing this many units, default: 100',
    progressIntervalHint: 'Refresh progress after this many units, default: 10',
    subtitleBatchSizeHint: 'Recommended: 10-20, max: 30',
    subtitleBatchSizeRule: 'Batch translation count must be between 1 and 30',
    langChinese: 'Chinese',
    langEnglish: 'English',
    userSavedModel: 'User saved model',
    testingModel: 'Connection successful, testing if model {model} is available...',
    balanceCheckFailed: 'Failed to check balance: {error}'
  },
  about: {
    title: 'About',
    appName: 'DeepLingo',
    version: 'Version',
    features: 'Main Features',
    textTranslate: 'Text Translation',
    textTranslateDesc: 'Supports instant translation between multiple languages',
    documentTranslate: 'Document Translation',
    documentTranslateDesc: 'Supports batch translation of various document formats',
    subtitleTranslate: 'Subtitle Translation',
    subtitleTranslateDesc: 'Supports intelligent translation of video subtitles',
    contact: 'Contact & Support',
    feedbackEmail: 'Feedback Email',
    github: 'GitHub',
    copyright: 'Copyright',
    allRightsReserved: 'All rights reserved.'
  },
  errors: {
    emptySource: 'Source text is empty',
    translating: 'Translation in progress',
    apiKeyMissing: 'API Key not set',
    connectionFailed: 'Connection failed: {error}',
    translateFailed: 'Translation failed: {error}',
    balanceCheckFailed: 'Failed to check balance: {error}',
    fileReadFailed: 'File read failed: {error}',
    fileSaveFailed: 'File save failed: {error}',
    invalidFile: 'Invalid file format',
    noSubtitles: 'No subtitles found',
    timeout: 'Request timeout',
    unknownError: 'Unknown error',
    connectionSuccessModelNotInstalled: 'Connection successful, but model {baseModelName} is not installed. Please run \'ollama pull {baseModelName}\' to install the model.',
    modelParamsLoadFailed: 'Failed to get model parameters, please select manually',
    refreshModelListFailed: 'Failed to refresh model list'
  },
  log: {
    searchFileName: 'Search by file name',
    status: 'Status',
    type: 'Translate Type',
    startDate: 'Start Date',
    endDate: 'End Date',
    sortDesc: 'Sort by time descending',
    sortAsc: 'Sort by time ascending',
    refresh: 'Refresh',
    clear: 'Clear',
    empty: 'No log records',
    emptyTip: 'Try adjusting filters or clearing them',
    completed: 'Completed',
    uncompleted: 'Uncompleted',
    error: 'Error',
    unknownType: 'Unknown Type',
    file: 'File',
    language: 'Language',
    count: 'Translate Count',
    startTime: 'Start Time',
    endTime: 'End Time',
    duration: 'Duration',
    clearConfirm: 'Are you sure you want to clear all logs?',
    pageStats: '{start}-{end} of {total}',
    perPage: '{count} per page',
    noLogs: 'No logs',
    clearSuccess: 'Logs cleared',
    clearFailed: 'Failed to clear logs: {error}',
    text: 'Text Translation',
    document: 'Document Translation',
    subtitle: 'Subtitle Translation'
  },
  results: {
    search: 'Search',
    type: 'Type',
    status: 'Status',
    date: 'Date',
    clearFilters: 'Clear Filters',
    export: 'Export Results',
    source: 'Source Text',
    output: 'Translated Text',
    fileName: 'File Name',
    filePath: 'Output File',
    actions: 'Actions',
    details: 'Translation Details',
    close: 'Close',
    rename: 'Rename File',
    currentName: 'Current File Name',
    newName: 'New File Name',
    confirm: 'Confirm',
    cancel: 'Cancel',
    openFile: 'Open File',
    openFolder: 'Open Folder',
    renameSuccess: 'Rename successful',
    renameFailed: 'Rename failed: {error}',
    noResults: 'No translation results',
    pageStats: '{start}-{end} of {total}',
    perPage: '{count} per page',
    sourceLanguage: 'Source Language',
    targetLanguage: 'Target Language',
    statusSuccess: 'Success',
    statusFailed: 'Failed',
    view: 'View',
    renameSource: 'Rename Source File',
    renameOutput: 'Rename Output File',
    filePathInvalid: 'File path is incomplete or invalid: {filePath}',
    filePathEmpty: 'File path is empty',
    openFileFailed: 'Failed to open file: {error}',
    openFolderFailed: 'Failed to open folder: {error}',
    exportFailed: 'Failed to export translation results: {error}',
    clearSuccess: 'Results cleared',
    clearFailed: 'Failed to clear results: {error}'
  }
} 