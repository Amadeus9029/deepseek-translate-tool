<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import { settings, saveSettings as updateSettingsService, ollamaModelData as serviceOllamaModelData, saveOllamaModelData, updateModelParams } from '../services/SettingsService'
import { useTranslateStore } from '../stores/translateStore'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const store = useTranslateStore()

const apiKey = ref(settings.value.apiKey)
const showApiKey = ref(false)
const savePath = ref(settings.value.savePath || './')
const theme = useTheme()
const themeMode = ref('light')

// 翻译参数设置
const concurrentThreads = ref(String(settings.value.concurrentThreads))
const batchSize = ref(String(settings.value.batchSize))
const maxRetries = ref(String(settings.value.maxRetries))
const saveInterval = ref(String(settings.value.saveInterval))
const progressInterval = ref(String(settings.value.progressInterval))

// 字幕翻译设置
const subtitleBatchSize = ref(String(settings.value.subtitleBatchSize || 20))

// DeepSeek模型设置
const model = ref(settings.value.model)

// Ollama 设置
const useOllama = ref(settings.value.useOllama) 
const ollamaUrl = ref(settings.value.ollamaUrl)
const ollamaModel = ref(settings.value.ollamaModel)
const availableOllamaModels = ref<{title: string, value: string, description?: string}[]>([])
const isTestingConnection = ref(false)
const isLoadingOfficialModels = ref(false)
const connectionTestResult = ref('')

// 新增：模型参数选择相关
const selectedModelBase = ref<{title: string, value: string, description?: string} | null>(null) // 选择的基础模型名称
const selectedModelParam = ref('') // 选择的模型参数
const availableModelParams = ref<string[]>([]) // 可用的模型参数列表
const isLoadingModelParams = ref(false) // 是否正在加载模型参数

// 可用的模型列表
const availableModels = [
  { title: 'DeepSeek Chat', value: 'deepseek-chat' },
  { title: 'DeepSeek Reasoner', value: 'deepseek-reasoner' }
]

// Ollama 相关方法
const testOllamaConnection = async () => {
  isTestingConnection.value = true
  connectionTestResult.value = ''
  
  try {
    // 首先测试基本连接
    const result = await ipcRenderer.invoke('ollama-fetch', {
      baseUrl: ollamaUrl.value,
      path: '/api/tags',
      method: 'GET'
    });
    
    if (!result.success) {
      connectionTestResult.value = `<span class="text-error">连接失败：${result.error}</span>`;
      return;
    }
    
    // 如果有选择模型，测试模型是否可用
    if (selectedModelBase.value) {
      const modelName = selectedModelBase.value.value;
      
      // 获取本地已安装的模型列表
      const installedModels = result.data.models?.map((model: any) => model.name) || [];
      logger.info('本地已安装模型列表:', installedModels);
      
      // 检查模型是否在本地已安装（只检查基础模型名称，不包含参数部分）
      // 例如：如果选择了 "deepseek-r1:8b"，只检查 "deepseek-r1" 是否已安装
      const isModelInstalled = installedModels.some(name => {
        // 处理可能的模型名称格式差异
        // 有些模型可能是 "deepseek-r1:8b" 格式，有些可能只是 "deepseek-r1"
        const installedBaseName = name.split(':')[0];
        const selectedBaseName = modelName.split(':')[0];
        return installedBaseName === selectedBaseName;
      });
      
      if (isModelInstalled) {
        // 确定要测试的完整模型名称
        let testModelName = '';
        
        // 如果有完整模型名称（包含参数），优先使用
        if (ollamaModel.value && ollamaModel.value.includes(':')) {
          testModelName = ollamaModel.value;
        } else {
          // 否则使用基础模型名称
          testModelName = modelName.split(':')[0];
        }
        
        // 真正测试模型是否可用：向模型发送一个简单的测试消息
        connectionTestResult.value = `连接成功，正在测试模型 ${testModelName} 是否可用...`;
        
        try {
          // 使用generate API测试模型是否真正可用
          const generateResult = await ipcRenderer.invoke('ollama-fetch', {
            baseUrl: ollamaUrl.value,
            path: '/api/generate',
            method: 'POST',
            body: {
              model: testModelName,
              prompt: "简短回答：你是什么AI模型？",
              stream: false,
              options: {
                num_predict: 100  // 限制输出长度，加快测试速度
              }
            }
          });
          
          if (generateResult.success && generateResult.data && generateResult.data.response) {
            // 模型成功响应
            connectionTestResult.value = `<span class="text-success">连接成功！模型 ${testModelName} 可用。</span>`;
            logger.info('模型测试响应:', generateResult.data.response);
          } else {
            // 模型无法生成响应
            connectionTestResult.value = `连接成功，但模型 ${testModelName} 无响应。`;
            if (generateResult.error) {
              connectionTestResult.value = `连接成功，但模型 ${testModelName} 无响应。`;
            }
            // 添加提示用户运行模型的信息
            connectionTestResult.value += `\n请确认您已经运行了 ${testModelName} 模型。可使用命令: ollama run ${testModelName}`;
            connectionTestResult.value = `<span class="text-error">${connectionTestResult.value}</span>`;
            logger.error('模型测试失败:', generateResult);
          }
        } catch (modelError) {
          connectionTestResult.value = `连接成功，但模型 ${testModelName} 测试失败：${modelError}`;
          connectionTestResult.value += `\n请确认您已经运行了 ${testModelName} 模型。可使用命令: ollama run ${testModelName}`;
          connectionTestResult.value = `<span class="text-error">${connectionTestResult.value}</span>`;
          logger.error('模型测试异常:', modelError);
        }
      } else {
        // 模型未安装，提示用户
        // 使用基础模型名称（不包含参数）
        const baseModelName = modelName.split(':')[0];
        connectionTestResult.value = `<span class="text-error">连接成功，但模型 ${baseModelName} 未安装。请先使用命令 'ollama pull ${baseModelName}' 安装模型。</span>`;
      }
    } else {
      // 没有选择模型，只显示连接成功
      connectionTestResult.value = '<span class="text-success">连接成功！</span>';
    }
    
    // 不再将本地已安装的模型添加到模型列表中
    // 仅显示连接成功信息
    logger.info(`Ollama连接测试成功，检测到 ${result.data.models?.length || 0} 个本地已安装模型`);
  } catch (error) {
    connectionTestResult.value = `连接失败：${error}`
  } finally {
    isTestingConnection.value = false
  }
}

// 简化 fetchOfficialModels 函数，确保正确返回结果
const fetchOfficialModels = async () => {
  try {
    // 设置加载状态
    isLoadingOfficialModels.value = true;
    
    // 调用主进程获取Ollama官方库数据
    const result = await ipcRenderer.invoke('fetch-official-models');
    
    logger.info('获取Ollama官方模型列表结果:', result);
    
    if (result.success && result.models && result.models.length > 0) {
      // 将获取到的模型转换为下拉框格式
      const modelList = result.models.map((model: any) => {
        // 提取模型大小标签（如果有）
        const sizeTags = model.tags ? model.tags.filter((tag: string) => 
          /^\d+(\.\d+)?[bB]$/.test(tag) || tag.includes('vision') || tag.includes('tools') || tag.includes('thinking') || tag.includes('embedding')
        ) : [];
        
        // 构建模型标题，包含大小信息
        const modelTitle = `${model.name}${sizeTags.length > 0 ? ` (${sizeTags.join(', ')})` : ''}`;
        
        return {
          title: modelTitle,
          value: model.name,
          description: model.description || ''
        };
      });
      
      // 更新可用模型列表
      availableOllamaModels.value = modelList;
      
      // 更新Pinia存储中的模型数据
      store.updateOllamaModelData({
        availableModels: modelList
      });

      // 同时更新本地存储中的模型数据
      saveOllamaModelData({
        availableModels: modelList
      });
      
      // 只在刷新按钮点击后显示成功提示
      if (showSnackbar.value) {
        snackbarColor.value = 'success';
        snackbarText.value = `成功加载 ${modelList.length} 个远程模型`;
      }
      
      return true;
    } else {
      // 使用备用API获取模型列表
      return await fetchOfficialModelsFromAPI();
    }
  } catch (error) {
    logger.error('获取官方模型列表失败:', error);
    
    // 使用备用方案
    return await fetchOfficialModelsFromAPI();
  } finally {
    isLoadingOfficialModels.value = false;
  }
}

// 简化 fetchOfficialModelsFromAPI 函数
const fetchOfficialModelsFromAPI = async () => {
  try {
    // 设置加载状态
    isLoadingOfficialModels.value = true;
    
    // 调用主进程获取Ollama API模型数据
    const result = await ipcRenderer.invoke('fetch-ollama-api-models');
    logger.info('从Ollama API获取模型列表结果:', result);
    
    if (result.success && result.models && result.models.length > 0) {
      // 将获取到的模型转换为下拉框格式
      const modelList = result.models.map((model: any) => {
        // 构建模型标题，包含大小信息
        const modelTitle = `${model.name}${model.tags.length > 0 ? ` (${model.tags.join(', ')})` : ''}`;
        
        return {
          title: modelTitle,
          value: model.name,
          description: model.description || ''
        };
      });
      
      // 更新可用模型列表
      availableOllamaModels.value = modelList;
      
      // 更新Pinia存储中的模型数据
      store.updateOllamaModelData({
        availableModels: modelList
      });

      // 同时更新本地存储中的模型数据
      saveOllamaModelData({
        availableModels: modelList
      });
      
      // 显示成功提示
      if (showSnackbar.value) {
        snackbarColor.value = 'success';
        snackbarText.value = `成功加载 ${modelList.length} 个模型`;
        showSnackbar.value = true;
      }
      
      return true;
    } else {
      logger.error('获取官方模型列表失败:', result.error);
      
      // 显示失败提示
      if (showSnackbar.value) {
        snackbarColor.value = 'error';
        snackbarText.value = '模型加载失败';
        showSnackbar.value = true;
      }
      
      return false;
    }
  } catch (error) {
    logger.error('获取备用模型列表失败:', error);
    
    // 显示失败提示
    if (showSnackbar.value) {
      snackbarColor.value = 'error';
      snackbarText.value = '模型加载失败';
      showSnackbar.value = true;
    }
    
    return false;
  } finally {
    isLoadingOfficialModels.value = false;
  }
}

// 简化 loadOllamaModels 函数，修复模型列表加载问题
const loadOllamaModels = async () => {
  try {
    // 先检查本地存储中是否有模型数据
    const cachedData = store.ollamaModelData;
    
    // 如果有缓存的模型数据且不为空，直接使用
    if (cachedData.availableModels && cachedData.availableModels.length > 0) {
      logger.info('使用本地缓存的模型列表数据');
      availableOllamaModels.value = cachedData.availableModels;
      
      // 检查用户之前选择的模型
      await checkAndSetUserModel();
      return;
    }
    
    // 如果没有缓存数据，则获取远程模型列表
    logger.info('本地无缓存数据，获取远程模型列表');
    await fetchOfficialModels();
    
    // 检查用户之前选择的模型
    await checkAndSetUserModel();
  } catch (error) {
    logger.error('获取 Ollama 模型列表失败:', error);
    
    // 检查用户之前选择的模型
    await checkAndSetUserModel();
  }
}

// 监听 Ollama URL 变化
watch(ollamaUrl, async (newUrl) => {
  if (newUrl && useOllama.value) {
    await loadOllamaModels()
  }
})

// 监听 useOllama 变化
watch(useOllama, async (newValue) => {
  if (newValue) {
    // 加载模型列表
    await loadOllamaModels();
  } else {
    // 切换到API Key模式，清空模型选择界面，但保留ollamaModel的值
    selectedModelBase.value = null;
    selectedModelParam.value = '';
    availableModelParams.value = [];
  }
});

// 监听主题变化
watch(themeMode, (newMode) => {
  updateTheme(newMode)
  localStorage.setItem('theme-mode', newMode)
})

// 选择存储路径
const selectSavePath = async () => {
  try {
    const result = await ipcRenderer?.invoke('select-directory')
    if (result?.success && result.dirPath) {
      savePath.value = result.dirPath
    }
  } catch (error) {
    logger.error('选择存储路径失败:', error)
  }
}

// 在组件挂载时加载设置
onMounted(async () => {
  await loadSettings();
  
  const savedTheme = localStorage.getItem('theme-mode');
  if (savedTheme) {
    themeMode.value = savedTheme;
    updateTheme(savedTheme);
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (themeMode.value === 'system') {
      theme.global.name.value = e.matches ? 'dark' : 'light';
    }
  });
  
  // 如果使用Ollama，加载模型列表
  if (useOllama.value) {
    await loadOllamaModels();
  }
});

// 保存设置
const showSnackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const saveSettings = async () => {
  // 如果当前使用Ollama并且有选择模型，更新ollamaModel值
  if (useOllama.value && selectedModelBase.value) {
    updateFullModelName();
  }
  
  // 创建设置对象
  const newSettings = {
    apiKey: apiKey.value,
    savePath: savePath.value,
    concurrentThreads: Number(concurrentThreads.value),
    batchSize: Number(batchSize.value),
    maxRetries: Number(maxRetries.value),
    saveInterval: Number(saveInterval.value),
    progressInterval: Number(progressInterval.value),
    model: model.value,
    subtitleBatchSize: Number(subtitleBatchSize.value),
    useOllama: useOllama.value,
    ollamaUrl: ollamaUrl.value,
    ollamaModel: ollamaModel.value,
    themeMode: themeMode.value as 'system' | 'light' | 'dark'
  }
  
  // 保存设置到本地存储
  updateSettingsService(newSettings)
  
  // 更新Pinia状态
  store.updateSettings(newSettings)

  // 保存设置到主进程
  try {
    const result = await ipcRenderer?.invoke('save-settings', {
      apiKey: apiKey.value,
      savePath: savePath.value,
      concurrentThreads: Number(concurrentThreads.value),
      batchSize: Number(batchSize.value),
      maxRetries: Number(maxRetries.value),
      saveInterval: Number(saveInterval.value),
      progressInterval: Number(progressInterval.value),
      model: model.value,
      subtitleBatchSize: Number(subtitleBatchSize.value),
      useOllama: useOllama.value,
      ollamaUrl: ollamaUrl.value,
      ollamaModel: ollamaModel.value
    })
    if (!result?.success) {
      snackbarColor.value = 'error'
      snackbarText.value = '保存设置失败: ' + result?.error
    } else {
      snackbarColor.value = 'success'
      snackbarText.value = '设置保存成功'
    }
    showSnackbar.value = true
  } catch (error) {
    snackbarColor.value = 'error'
    snackbarText.value = '保存设置失败: ' + error
    showSnackbar.value = true
  }
}

// 加载设置
const loadSettings = async () => {
  try {
    const result = await ipcRenderer?.invoke('read-settings')
    if (result?.success && result.settings) {
      // 更新本地设置
      updateSettingsService(result.settings)
      // 更新Pinia状态
      store.updateSettings(result.settings)
      // 更新响应式变量
      apiKey.value = result.settings.apiKey || ''
      savePath.value = result.settings.savePath || ''
      concurrentThreads.value = String(result.settings.concurrentThreads || 5)
      batchSize.value = String(result.settings.batchSize || 10)
      maxRetries.value = String(result.settings.maxRetries || 3)
      saveInterval.value = String(result.settings.saveInterval || 100)
      progressInterval.value = String(result.settings.progressInterval || 10)
      model.value = result.settings.model || 'deepseek-chat'
      subtitleBatchSize.value = String(result.settings.subtitleBatchSize || 20)
      useOllama.value = result.settings.useOllama || false
      ollamaUrl.value = result.settings.ollamaUrl || 'http://localhost:11434'
      ollamaModel.value = result.settings.ollamaModel || 'deepseek-r1:7b'
      themeMode.value = result.settings.themeMode || 'system'
    }
  } catch (error) {
    logger.error('加载设置失败:', error)
  }
}

// 主题切换函数
const updateTheme = (mode: string) => {
  if (mode === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.global.name.value = prefersDark ? 'dark' : 'light'
  } else {
    theme.global.name.value = mode
  }
}

// 确保ensureUserModelDisplayed函数被调用
const checkAndSetUserModel = async () => {
  if (ollamaModel.value) {
    // 解析模型名称，格式可能是 "modelName:param"
    const parts = ollamaModel.value.split(':');
    
    // 获取基础模型名称（不包含参数）
    const baseModelName = parts[0];
    
    // 查找匹配的模型对象（只匹配基础模型名称）
    const modelExists = availableOllamaModels.value.some(m => {
      const modelBaseName = m.value.split(':')[0];
      return modelBaseName === baseModelName;
    });
    
    if (modelExists) {
      // 如果模型存在于当前列表中，设置为选中状态
      const modelObj = availableOllamaModels.value.find(m => {
        const modelBaseName = m.value.split(':')[0];
        return modelBaseName === baseModelName;
      });
      
      if (modelObj) {
        selectedModelBase.value = modelObj;
        
        // 如果有参数部分
        if (parts.length > 1) {
          const modelParam = parts[1];
          // 加载参数列表
          await loadModelParams(baseModelName);
        } else {
          // 加载参数列表
          await loadModelParams(baseModelName);
        }
      }
    } else if (availableOllamaModels.value.length > 0) {
      // 如果模型不存在于当前列表中，选择第一个可用的模型
      selectedModelBase.value = availableOllamaModels.value[0];
      await loadModelParams(selectedModelBase.value.value);
    } else {
      // 如果模型列表为空，确保显示用户之前选择的模型
      ensureUserModelDisplayed();
    }
  } else if (availableOllamaModels.value.length > 0) {
    // 如果没有之前选择的模型，选择第一个可用的模型
    selectedModelBase.value = availableOllamaModels.value[0];
    await loadModelParams(selectedModelBase.value.value);
  }
};

// 添加自定义日志函数
const logger = {
  info: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.log(`[${time}] [INFO] ${message}`, ...args)
    } else {
      console.log(`[${time}] [INFO] ${message}`)
    }
  },
  
  error: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.error(`[${time}] [ERROR] ${message}`, ...args)
    } else {
      console.error(`[${time}] [ERROR] ${message}`)
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    const time = new Date().toLocaleTimeString('zh-CN')
    if (args.length > 0) {
      console.warn(`[${time}] [WARN] ${message}`, ...args)
    } else {
      console.warn(`[${time}] [WARN] ${message}`)
    }
  }
}

// 简化 loadModelParams 函数，增加缓存逻辑
const loadModelParams = async (modelName: string): Promise<void> => {
  if (!modelName) return;
  
  try {
    // 确保使用基础模型名称（不包含参数）
    const baseModelName = modelName.split(':')[0];
    
    // 设置加载状态
    isLoadingModelParams.value = true;
    
    // 检查是否有保存在ollamaModel中的参数
    let savedParam = '';
    if (ollamaModel.value && ollamaModel.value.includes(':')) {
      const parts = ollamaModel.value.split(':');
      if (parts[0] === baseModelName && parts.length > 1) {
        savedParam = parts[1];
        logger.info(`检测到用户之前保存的参数: ${savedParam}`);
      }
    }
    
    // 检查是否有缓存的参数数据
    const cachedParams = store.ollamaModelData.modelParams[baseModelName];
    if (cachedParams && cachedParams.length > 0) {
      logger.info(`使用缓存的参数列表: ${baseModelName}`, cachedParams);
      availableModelParams.value = cachedParams;
      
      // 如果有保存的参数但不在列表中，添加到列表
      if (savedParam && !availableModelParams.value.includes(savedParam)) {
        availableModelParams.value.push(savedParam);
        store.updateModelParams(baseModelName, availableModelParams.value);
      }
      
      // 设置选中的参数
      if (savedParam) {
        selectedModelParam.value = savedParam;
      } else if (availableModelParams.value.length > 0) {
        selectedModelParam.value = availableModelParams.value[0];
      }
      
      // 更新完整的模型名称
      updateFullModelName();
      isLoadingModelParams.value = false;
      return;
    }
    
    // 如果没有缓存数据，调用主进程获取模型参数
    logger.info(`无缓存参数数据，获取模型 ${baseModelName} 的参数列表...`);
    const result = await ipcRenderer.invoke('fetch-model-params', baseModelName);
    
    if (result.success && result.params && result.params.length > 0) {
      // 更新可用参数列表
      availableModelParams.value = result.params;
      
      // 更新Pinia存储中的参数列表
      store.updateModelParams(baseModelName, result.params);
      
      // 如果有保存的参数但不在列表中，添加到列表
      if (savedParam && !availableModelParams.value.includes(savedParam)) {
        availableModelParams.value.push(savedParam);
        store.updateModelParams(baseModelName, availableModelParams.value);
      }
      
      // 设置选中的参数
      if (savedParam) {
        selectedModelParam.value = savedParam;
      } else if (availableModelParams.value.length > 0) {
        selectedModelParam.value = availableModelParams.value[0];
      }
      
      // 更新完整的模型名称
      updateFullModelName();
    } else {
      logger.error('获取模型参数失败:', result.error);
      
      // 如果有保存的参数，使用它
      if (savedParam) {
        selectedModelParam.value = savedParam;
        availableModelParams.value = [savedParam];
        store.updateModelParams(baseModelName, availableModelParams.value);
        updateFullModelName();
      } else {
        snackbarColor.value = 'warning';
        snackbarText.value = '获取模型参数失败，请手动选择';
        showSnackbar.value = true;
      }
    }
  } catch (error) {
    logger.error('加载模型参数失败:', error);
    
    // 检查是否有保存在ollamaModel中的参数
    if (ollamaModel.value && ollamaModel.value.includes(':')) {
      const parts = ollamaModel.value.split(':');
      const baseModelName = selectedModelBase.value?.value.split(':')[0] || '';
      if (parts[0] === baseModelName && parts.length > 1) {
        const savedParam = parts[1];
        selectedModelParam.value = savedParam;
        availableModelParams.value = [savedParam];
        
        if (baseModelName) {
          store.updateModelParams(baseModelName, availableModelParams.value);
        }
        
        updateFullModelName();
      }
    }
  } finally {
    isLoadingModelParams.value = false;
  }
};

// 更新完整的模型名称
const updateFullModelName = () => {
  if (selectedModelBase.value) {
    // 获取基础模型名称（不包含参数）
    const baseModelName = selectedModelBase.value.value.split(':')[0];
    
    if (selectedModelParam.value) {
      // 如果有参数，使用基础模型名称:参数格式
      ollamaModel.value = `${baseModelName}:${selectedModelParam.value}`;
    } else {
      // 如果没有参数，只使用基础模型名称
      ollamaModel.value = baseModelName;
    }
    
    logger.info('更新完整模型名称:', ollamaModel.value);
  } else {
    // 如果模型被清空，也清空完整模型名称
    ollamaModel.value = '';
    logger.info('模型被清空，清空完整模型名称');
  }
};

// 监听选择的基础模型变化
watch(selectedModelBase, async (newValue) => {
  if (newValue) {
    await loadModelParams(newValue.value);
  } else {
    // 如果模型被清空，也清空参数选择
    selectedModelParam.value = '';
    availableModelParams.value = [];
    logger.info('模型被清空，清空参数选择');
  }
});

// 监听选择的模型参数变化
watch(selectedModelParam, () => {
  updateFullModelName();
});

// 添加自定义过滤函数
const customFilter = (item: any, query: string, itemText: string) => {
  const text = itemText.toLowerCase();
  const queryText = query.toLowerCase();
  return text.indexOf(queryText) > -1;
};

// 手动刷新模型列表
const refreshModelList = async () => {
  // 设置标志，表示这是用户手动刷新，应该显示提示
  showSnackbar.value = true;
  
  try {
    // 强制重新获取模型列表，忽略缓存
    await fetchOfficialModels();
    
    // 更新Pinia存储中的模型数据
    store.updateOllamaModelData({
      availableModels: availableOllamaModels.value
    });

    // 同时更新本地存储中的模型数据
    saveOllamaModelData({
      availableModels: availableOllamaModels.value
    });
  } catch (error) {
    logger.error('刷新模型列表失败:', error);
    snackbarColor.value = 'error';
    snackbarText.value = '刷新模型列表失败';
    showSnackbar.value = true;
  }
}

// 确保显示用户之前选择的模型，即使在远程模型列表中找不到
const ensureUserModelDisplayed = () => {
  // 如果已经有选择的模型，不需要处理
  if (selectedModelBase.value) {
    return;
  }
  
  // 如果有保存的模型值但没有对应的选择项
  if (ollamaModel.value && useOllama.value) {
    // 解析模型名称
    const parts = ollamaModel.value.split(':');
    const baseModelName = parts[0];
    
    // 创建一个临时模型对象
    const tempModel = {
      title: baseModelName,
      value: baseModelName,
      description: '用户保存的模型'
    };
    
    // 添加到模型列表的最前面
    if (!availableOllamaModels.value.some(m => m.value.split(':')[0] === baseModelName)) {
      availableOllamaModels.value.unshift(tempModel);
      logger.info(`添加用户保存的模型 ${baseModelName} 到列表`);
    }
    
    // 设置为选中状态
    selectedModelBase.value = tempModel;
    
    // 如果有参数部分
    if (parts.length > 1) {
      const modelParam = parts[1];
      selectedModelParam.value = modelParam;
      // 添加到参数列表
      if (!availableModelParams.value.includes(modelParam)) {
        availableModelParams.value.push(modelParam);
      }
      logger.info(`设置用户保存的模型参数: ${modelParam}`);
    }
  }
}
</script>

<template>
  <div class="page-container">
    <v-card class="translate-card" flat>
      <v-card-title class="settings-title">
        <span>设置</span>
      </v-card-title>
      
      <v-card-text>
        <!-- DeepSeek API设置 -->
        <div class="section-title">DeepSeek API设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-text-field
              v-model="apiKey"
              :type="showApiKey ? 'text' : 'password'"
              label="API Key"
              :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="showApiKey = !showApiKey"
            ></v-text-field>
            <div class="text-caption text-grey">注意：请确保API Key有足够的余额，余额不足时翻译将会失败。</div>
          </v-col>
        </v-row>

        <!-- DeepSeek模型设置 -->
        <div class="section-title">模型设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-select
              v-model="model"
              :items="availableModels"
              label="选择模型"
              item-title="title"
              item-value="value"
              persistent-hint
              hint="DeepSeek Reasoner模型效果更好但费用更高，请根据需求选择"
              :disabled="useOllama"
            ></v-select>
            <div class="text-caption text-grey mt-2">
              注意：DeepSeek Reasoner模型的翻译质量更高，但会消耗更多API额度，建议重要文档使用此模型。
            </div>
          </v-col>
        </v-row>

        <!-- Ollama 设置 -->
        <div class="section-title">Ollama 本地 AI 设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-switch
              v-model="useOllama"
              label="使用 Ollama 本地 AI"
              color="primary"
              hide-details
            ></v-switch>
            <div class="text-caption text-grey mt-2">
              启用后将使用本地 Ollama 服务进行翻译，无需 API Key，但需要先安装并运行 Ollama。
            </div>
          </v-col>
        </v-row>

        <v-row v-if="useOllama" class="mb-6">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="ollamaUrl"
              label="Ollama 服务地址"
              hint="默认：http://localhost:11434"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-btn
              color="primary"
              variant="outlined"
              :loading="isTestingConnection"
              @click="testOllamaConnection"
            >
              测试连接
            </v-btn>
            <div v-if="connectionTestResult" class="text-caption mt-1" v-html="connectionTestResult"></div>
          </v-col>
          <v-col cols="12">
            <!-- 两级选择：模型名称和参数大小 -->
            <div class="d-flex">
              <v-autocomplete
                v-model="selectedModelBase"
                :items="availableOllamaModels"
                label="选择模型名称"
                hint="先选择模型名称"
                persistent-hint
                :loading="isTestingConnection || isLoadingOfficialModels"
                item-title="title"
                item-value="value"
                return-object
                clearable
                :filter="customFilter"
                density="comfortable"
                :menu-props="{ maxHeight: 300 }"
              ></v-autocomplete>
              <v-autocomplete
                v-model="selectedModelParam"
                :items="availableModelParams"
                label="选择参数大小"
                hint="再选择参数大小"
                persistent-hint
                :loading="isLoadingModelParams"
                :disabled="availableModelParams.length === 0"
                density="comfortable"
                :menu-props="{ maxHeight: 300 }"
                clearable
              ></v-autocomplete>
            </div>
            <div class="text-caption text-grey mt-1">
              当前选择的完整模型：{{ ollamaModel }}
            </div>
            <div class="d-flex align-center mt-2">
              <v-btn
                color="primary"
                variant="text"
                size="small"
                :loading="isLoadingOfficialModels"
                @click="refreshModelList"
                class="mr-2"
              >
                <v-icon start>mdi-refresh</v-icon>
                刷新模型列表
              </v-btn>
              <div class="text-caption text-grey flex-grow-1">
                注意：首次使用需要先通过 Ollama 下载模型，例如：ollama pull deepseek-r1:7b
              </div>
            </div>
            <div class="text-caption text-grey mt-1">
              <strong>模型说明：</strong><br>
              • Q4版本：内存占用最少，适合低配置设备<br>
              • Q8版本：平衡性能和内存占用<br>
              • FP16版本：最高精度，需要更多内存<br>
              • 数字越大模型越强，但需要更多计算资源<br>
              • 本地已安装的模型会显示在列表最前面
            </div>
          </v-col>
        </v-row>

        <!-- 主题设置 -->
        <div class="section-title">主题设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
            <v-radio-group v-model="themeMode" inline>
              <v-radio label="跟随系统" value="system"></v-radio>
              <v-radio label="明亮模式" value="light"></v-radio>
              <v-radio label="深色模式" value="dark"></v-radio>
            </v-radio-group>
          </v-col>
        </v-row>

        <!-- 存储设置 -->
        <div class="section-title">存储设置</div>
        <v-row class="mb-6">
          <v-col cols="12">
                          <v-text-field
              v-model="savePath"
              label="存储位置"
              append-inner-icon="mdi-folder"
              readonly
              @click:append-inner="selectSavePath"
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- 翻译参数设置 -->
        <div class="section-title">翻译参数设置</div>
        <v-row class="mb-6">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="concurrentThreads"
              label="并发线程数"
              type="number"
              hint="建议：1-10，默认：5"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="batchSize"
              label="批处理大小"
              type="number"
              hint="建议：5-20，默认：10"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="maxRetries"
              label="最大重试次数"
              type="number"
              hint="建议：1-5，默认：3"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="saveInterval"
              label="保存间隔"
              type="number"
              hint="每处理多少单元保存一次，默认：100"
              persistent-hint
            ></v-text-field>
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="progressInterval"
              label="进度显示间隔"
              type="number"
              hint="每处理多少单元刷新一次进度，默认：10"
              persistent-hint
            ></v-text-field>
          </v-col>
        </v-row>

        <!-- 字幕翻译设置 -->
        <div class="section-title">字幕翻译设置</div>
        <v-row>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="subtitleBatchSize"
              label="字幕批量翻译数量"
              type="number"
              hint="建议：10-20，最大值：30"
              persistent-hint
              :rules="[v => (v && Number(v) > 0 && Number(v) <= 30) || '批量翻译数量必须在1-30之间']"
            ></v-text-field>
          </v-col>
        </v-row>

        <v-row class="mt-6">
          <v-col cols="12" class="text-right">
            <v-btn color="primary" @click="saveSettings">保存设置</v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- 提示消息 -->
    <v-snackbar
      v-model="showSnackbar"
      :color="snackbarColor"
      :timeout="3000"
      location="top"
    >
      {{ snackbarText }}
    </v-snackbar>
  </div>
</template>

<style>
@import '../styles/common.css';

.debug-html, .debug-json {
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 400px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
}

/* 确保连接测试结果中的换行符能够正确显示 */
.text-caption {
  white-space: pre-line;
}
</style>

<style scoped>
.settings-page-wrapper {
  flex: 1 1 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  min-width: 0;
  background: transparent;
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
}

.settings-card {
  width: 100%;
  max-width: 1200px;
  max-height: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  margin: 0;
  display: flex;
  flex-direction: column;
  padding: 24px 24px 16px 24px;
  border: 1px solid rgb(var(--v-theme-surface-variant));
}

.settings-title {
  font-size: 24px;
  font-weight: bold;
  padding-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 16px;
  color: rgb(var(--v-theme-on-surface));
}
</style> 