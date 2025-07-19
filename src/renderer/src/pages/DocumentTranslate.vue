<template>
  <PageCard>
    <!-- 文件设置 -->
    <div class="section">
      <SectionHeader :title="t('documentTranslate.fileSettings')" />
      <FileSelector
        :filePath="store.documentTranslate.excelFile"
        :label="t('documentTranslate.documentFile')"
        :placeholder="t('documentTranslate.selectDocumentFile')"
        :disabled="store.documentTranslate.isTranslating"
        :buttonText="t('documentTranslate.selectFile')"
        @select="selectFile"
      />
    </div>

    <!-- 翻译参考设置（仅对Excel文件显示） -->
    <div v-if="isExcelFile" class="section">
      <SectionHeader :title="t('documentTranslate.referenceSettings')" />
      <div class="reference-options">
        <v-radio-group v-model="store.documentTranslate.referenceType" inline hide-details>
          <v-radio :label="t('documentTranslate.noReference')" value="none"></v-radio>
          <v-radio :label="t('documentTranslate.internalReference')" value="internal"></v-radio>
          <v-radio :label="t('documentTranslate.externalReference')" value="external"></v-radio>
        </v-radio-group>

        <!-- 内置参考源设置 -->
        <div v-if="store.documentTranslate.referenceType === 'internal'" class="mt-4">
          <v-select
            v-model="store.documentTranslate.internalRefLang"
            :items="availableLanguages"
            :label="t('documentTranslate.selectRefLanguage')"
            hide-details
            density="compact"
            variant="outlined"
            class="reference-select"
            item-title="text"
            item-value="value"
            return-object
            :menu-props="{ maxHeight: 300 }"
          ></v-select>
        </div>

        <!-- 外置参考源设置 -->
        <div v-if="store.documentTranslate.referenceType === 'external'" class="mt-4">
          <div class="mb-2">
            <FileSelector
              :filePath="store.documentTranslate.externalRefFile"
              :placeholder="t('documentTranslate.selectRefFile')"
              :disabled="store.documentTranslate.isTranslating"
              :buttonText="t('documentTranslate.selectFile')"
              @select="selectRefFile"
            />
          </div>
          <v-select
            v-model="store.documentTranslate.externalRefLang"
            :items="availableLanguages"
            :label="t('documentTranslate.selectRefLanguage')"
            hide-details
            density="compact"
            variant="outlined"
            class="reference-select"
            item-title="text"
            item-value="value"
            return-object
            :menu-props="{ maxHeight: 300 }"
          ></v-select>
        </div>
      </div>
    </div>

    <!-- 语言设置 -->
    <div class="section">
      <SectionHeader :title="t('documentTranslate.languageSettings')" />
      <div class="language-settings">
        <div class="source-language">
          <div class="label">{{ t('documentTranslate.sourceLanguage') }}</div>
          <v-autocomplete
            v-model="store.documentTranslate.sourceLanguage"
            :items="availableLanguages"
            hide-details
            density="compact"
            variant="outlined"
            class="language-select"
            item-title="text"
            item-value="value"
            return-object
            :menu-props="{ maxHeight: 300 }"
          ></v-autocomplete>
        </div>
        
        <div class="target-languages full-width">
          <div class="label">
            {{ t('documentTranslate.targetLanguages') }}
            <span class="language-count">
              {{ store.documentTranslate.selectedLanguages.length }}/{{ availableLanguages.length }}
            </span>
          </div>
          <v-autocomplete
            v-model="store.documentTranslate.selectedLanguages"
            :items="availableLanguages"
            hide-details
            density="compact"
            variant="outlined"
            class="language-select"
            item-title="text"
            item-value="value"
            chips
            closable-chips
            multiple
            clearable
            :menu-props="{ maxHeight: 300, contentClass: 'language-menu' }"
            :placeholder="t('documentTranslate.selectTargetLanguage')"
            @menu:open="fixGroupHeaders"
          >
            <template v-slot:selection="{ item, index }">
              <v-chip
                v-if="index < 3"
                size="small"
                closable
                @click:close="removeLanguage(item.raw.value || '')"
              >
                {{ item.title }}
              </v-chip>
              <span v-if="index === 3" class="text-grey ms-2">
                +{{ store.documentTranslate.selectedLanguages.length - 3 }} {{ t('documentTranslate.more') }}
              </span>
            </template>
            <template v-slot:item="{ item, props }">
              <!-- 分组标题 -->
              <v-list-subheader
                v-if="isGroupStart(item.raw)"
                class="language-group-header"
              >
                {{ getGroupTitle(item.raw) }}
              </v-list-subheader>

              <!-- 语言项 -->
              <v-list-item v-bind="props">
                <template v-slot:prepend>
                  <v-checkbox
                    :model-value="store.documentTranslate.selectedLanguages.includes(item.raw.value)"
                    hide-details
                    density="compact"
                  ></v-checkbox>
                </template>
              </v-list-item>
            </template>
          </v-autocomplete>
        </div>
      </div>
    </div>

    <!-- 开始翻译按钮 -->
    <ActionSection>
      <ActionButton
        :label="t('documentTranslate.startTranslate')"
        :loadingText="t('documentTranslate.translating')"
        :loading="store.documentTranslate.isTranslating"
        :disabled="store.documentTranslate.isTranslating"
        @click="startTranslate"
      />
    </ActionSection>

    <!-- 运行日志 -->
    <LogDisplay
      :logs="store.documentTranslate.logs"
      :title="t('documentTranslate.runningLogs')"
      :emptyText="t('documentTranslate.noLogs')"
    />
    <!-- <div v-if="translateProgress" style="color: #1976d2; margin-bottom: 12px;">{{ translateProgress }}</div> -->
  </PageCard>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, onUnmounted } from 'vue'
import { availableLanguages, type LanguageOption } from '../constants/languages'
import { useTranslateStore } from '../stores/translateStore'
import { DocumentTranslateHandler, type ExcelRow, DocumentTranslateService } from '../services/TranslateHandlers'
import PageCard from '../components/ui/PageCard.vue'
import FileSelector from '../components/ui/FileSelector.vue'
import SectionHeader from '../components/ui/SectionHeader.vue'
import ActionButton from '../components/ui/ActionButton.vue'
import ActionSection from '../components/ui/ActionSection.vue'
import LogDisplay from '../components/ui/LogDisplay.vue'
import { useI18n } from 'vue-i18n'
import { getSetting } from '../services/SettingsService'

const { ipcRenderer } = window.require ? window.require('electron') : { ipcRenderer: null }
const store = useTranslateStore()
const { t } = useI18n()

const translateProgress = ref<string>('')

// 判断是否为Excel文件
const isExcelFile = computed(() => {
  if (!store.documentTranslate.excelFile) return false
  const ext = store.documentTranslate.excelFile.toLowerCase().split('.').pop()
  return ext === 'xlsx' || ext === 'xls'
})

// 判断是否为Word文件
const isWordFile = computed(() => {
  if (!store.documentTranslate.excelFile) return false;
  const ext = store.documentTranslate.excelFile.toLowerCase().split('.').pop();
  return ext === 'docx';
});

// 语言分组和置顶
const languageGroups = [
  {
    title: '核心语言（高熟练度，流畅交流）',
    start: 0,
    end: 15
  },
  {
    title: '中等熟练度',
    start: 15,
    end: 35
  },
  {
    title: '基础交流',
    start: 35,
    end: 65
  },
  {
    title: '其他语言',
    start: 65,
    end: availableLanguages.length
  }
];

// 检查是否为分组开始
const isGroupStart = (item: any): boolean => {
  if (!item) return false;
  const index = availableLanguages.findIndex(lang => lang.value === item.value);
  return languageGroups.some(group => group.start === index);
};

// 获取分组标题
const getGroupTitle = (item: any): string => {
  if (!item) return '';
  const index = availableLanguages.findIndex(lang => lang.value === item.value);
  const group = languageGroups.find(group => group.start === index);
  return group ? group.title : '';
};

// 移除选定的目标语言
const removeLanguage = (langValue: string) => {
  if (!langValue) return;
  
  store.documentTranslate.selectedLanguages = store.documentTranslate.selectedLanguages.filter(
    lang => lang !== langValue
  );
};

// 组件挂载后添加样式修复
onMounted(() => {
  // 如果状态为空，设置默认值
  if (!store.documentTranslate.sourceLanguage) {
    store.documentTranslate.sourceLanguage = { text: '英语 (English)', value: '英语' } as LanguageOption
  }
  
  // 如果目标语言为空，默认选择中文
  if (!store.documentTranslate.selectedLanguages || store.documentTranslate.selectedLanguages.length === 0) {
    // 查找中文选项
    const chineseOption = availableLanguages.find(lang => lang.value === '中文');
    if (chineseOption) {
      store.documentTranslate.selectedLanguages = [chineseOption.value];
    }
  }
  
  // 设置默认的参考语言
  if (!store.documentTranslate.internalRefLang) {
    // 默认使用英语作为内部参考语言
    store.documentTranslate.internalRefLang = { text: '英语 (English)', value: '英语' } as LanguageOption;
  }
  
  if (!store.documentTranslate.externalRefLang) {
    // 默认使用英语作为外部参考语言
    store.documentTranslate.externalRefLang = { text: '英语 (English)', value: '英语' } as LanguageOption;
  }
  
  // 添加全局样式修复
  const style = document.createElement('style');
  style.id = 'language-group-fix';
  style.textContent = `
    .v-overlay__content .v-list-subheader.language-group-header {
      position: sticky !important;
      top: 0 !important;
      z-index: 100 !important;
      background-color: rgb(var(--v-theme-surface)) !important;
    }
    .v-overlay__content .v-list {
      padding-top: 0 !important;
    }
  `;
  document.head.appendChild(style);
});

// 组件卸载时移除事件监听和样式
onUnmounted(() => {
  // 移除添加的全局样式
  const style = document.getElementById('language-group-fix');
  if (style) {
    style.remove();
  }
  
  // 移除滚动监听器
  const list = document.querySelector('.v-overlay__content .v-list');
  if (list) {
    list.removeEventListener('scroll', monitorScroll);
  }
});

// 选择文件（支持Excel和docx，doc弹窗提示）
async function selectFile() {
  const filePath = await DocumentTranslateHandler.selectFile(
    ipcRenderer, 
    store.addDocumentLog,
    t
  )
  if (filePath) {
    const ext = filePath.toLowerCase().split('.').pop()
    if (ext === 'doc') {
      window.alert('暂不支持doc格式，请用Word另存为docx后再上传！')
      return
    }
    store.documentTranslate.excelFile = filePath
  }
}

// 选择参考Excel文件
async function selectRefFile() {
  const filePath = await DocumentTranslateHandler.selectRefFile(
    ipcRenderer, 
    store.addDocumentLog,
    t
  )
  
  if (filePath) {
    store.documentTranslate.externalRefFile = filePath
  }
}

// 统一的错误处理函数
const handleTranslateError = (err: any) => {
  const errorMessage = err?.message || err;
  window.alert(t('documentTranslate.translateFailed', { error: errorMessage }));
  store.addDocumentLog(t('documentTranslate.logError', { error: errorMessage }));
}

// 获取翻译配置
const getTranslateConfig = () => {
  // 基础配置
  const baseConfig = {
    ipcRenderer,
    documentFile: store.documentTranslate.excelFile,
    sourceLang: store.documentTranslate.sourceLanguage || { text: '英语', value: '英语' },
    selectedLanguages: store.documentTranslate.selectedLanguages,
    addLog: store.addDocumentLog,
    t,
    setIsTranslating: (value: boolean) => store.documentTranslate.isTranslating = value
  };

  // 翻译服务配置
  const translateConfig = {
    url: getSetting('ollamaUrl'),
    model: getSetting('useOllama') ? getSetting('ollamaModel') : getSetting('model'),
    useOllama: getSetting('useOllama'),
    apiKey: getSetting('apiKey')
  };

  return {
    ...baseConfig,
    translateConfig
  };
};

// 获取Excel特定配置
const getExcelConfig = () => {
  const internalRefLang = store.documentTranslate.internalRefLang 
    ? store.documentTranslate.internalRefLang.value 
    : '';
    
  const externalRefLang = store.documentTranslate.externalRefLang 
    ? store.documentTranslate.externalRefLang.value 
    : '';
    
  return {
    referenceType: store.documentTranslate.referenceType,
    internalRefLang,
    externalRefFile: store.documentTranslate.externalRefFile,
    externalRefLang
  };
};

// 文档翻译主函数
const translateDocument = async () => {
  try {
    const fileType = DocumentTranslateHandler.getFileType(store.documentTranslate.excelFile);
    const config = getTranslateConfig();
    
    const result = await (fileType === 'word' 
      ? DocumentTranslateService.translateDocx({
          ...config,
          savePath: getSetting('savePath')
        })
      : DocumentTranslateService.translateExcel({
          ...config,
          ...getExcelConfig()
        })
    );

    if (!result.success) {
      throw new Error(result.error);
    }
  } catch (err) {
    handleTranslateError(err);
  }
}

// 开始翻译
async function startTranslate() {
  translateProgress.value = ''
  // 验证参数
  const isValid = DocumentTranslateHandler.validateTranslateParams(
    store.documentTranslate.excelFile,
    store.documentTranslate.selectedLanguages,
    store.documentTranslate.referenceType,
    store.documentTranslate.internalRefLang ? store.documentTranslate.internalRefLang.value : '',
    store.documentTranslate.externalRefFile,
    store.documentTranslate.externalRefLang ? store.documentTranslate.externalRefLang.value : '',
    store.addDocumentLog,
    t
  )
  if (!isValid) return

  await translateDocument();
}

// 修复分组标题的置顶问题
const fixGroupHeaders = () => {
  // 使用多次延迟检查，确保所有标题都能正确置顶
  const applyStyles = () => {
    const headers = document.querySelectorAll('.language-group-header');
    if (headers.length > 0) {
      headers.forEach(header => {
        const headerEl = header as HTMLElement;
        headerEl.style.position = 'sticky';
        headerEl.style.top = '0';
        headerEl.style.zIndex = '100';
        headerEl.style.backgroundColor = 'rgb(var(--v-theme-surface))';
        headerEl.style.borderBottom = '1px solid rgba(var(--v-theme-on-surface), 0.12)';
        headerEl.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)';
        headerEl.style.margin = '0';
        headerEl.style.padding = '8px 16px';
      });
      
      // 确保列表没有顶部内边距
      const list = document.querySelector('.v-overlay__content .v-list');
      if (list) {
        (list as HTMLElement).style.paddingTop = '0';
        
        // 添加滚动监听，确保在滚动过程中标题始终置顶
        list.removeEventListener('scroll', monitorScroll); // 先移除可能存在的监听器
        list.addEventListener('scroll', monitorScroll);
      }
    }
  };
  
  // 立即应用一次
  applyStyles();
  
  // 延迟100ms后再应用一次
  setTimeout(applyStyles, 100);
  
  // 延迟300ms后再应用一次，确保在DOM完全渲染后应用
  setTimeout(applyStyles, 300);
  
  // 延迟500ms后再应用一次，以防万一
  setTimeout(applyStyles, 500);
  
  // 每秒检查一次，持续5秒
  const interval = setInterval(applyStyles, 1000);
  setTimeout(() => {
    clearInterval(interval);
  }, 5000);
};

// 监听滚动事件
const monitorScroll = () => {
  const headers = document.querySelectorAll('.language-group-header');
  headers.forEach(header => {
    const headerEl = header as HTMLElement;
    headerEl.style.position = 'sticky';
    headerEl.style.top = '0';
    headerEl.style.zIndex = '100';
    headerEl.style.backgroundColor = 'rgb(var(--v-theme-surface))';
  });
};
</script>

<style scoped>
.reference-options {
  padding: 16px;
  background: rgba(var(--v-theme-surface-variant), 0.1);
  border-radius: 8px;
}

.language-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.source-language {
  display: flex;
  align-items: center;
  gap: 16px;
}

.target-languages {
  width: 100%;
}

.full-width {
  width: 100%;
}

.label {
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.source-language .label {
  min-width: 80px;
}

.target-languages .label {
  margin-bottom: 8px;
}

.source-language .language-select {
  width: 180px;
}

.target-languages .language-select {
  width: 100%;
}

.language-count {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-left: 8px;
}

.language-group-header {
  position: sticky !important;
  top: 0 !important;
  z-index: 10 !important;
  background-color: rgb(var(--v-theme-surface)) !important;
  font-weight: bold !important;
  color: rgb(var(--v-theme-primary)) !important;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), 0.12);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 8px 16px !important;
  font-size: 14px !important;
  margin: 0 !important;
  min-height: 40px !important;
  /* 确保完全置顶，没有间隙 */
  margin-top: 0 !important;
  width: 100% !important;
}

/* 修复v-list-subheader的默认样式 */
.v-list-subheader.language-group-header {
  height: auto !important;
  line-height: 1.5 !important;
  padding-top: 8px !important;
  padding-bottom: 8px !important;
}

.v-list-item .v-checkbox {
  margin-right: 8px;
}

.reference-select {
  width: 340px;
}

.section {
  margin-bottom: 24px;
}

.language-menu .v-list {
  padding-top: 0 !important;
}

.language-menu .v-list-item {
  min-height: 36px !important;
}
</style> 