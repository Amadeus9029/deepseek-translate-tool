<!-- Word文档解析结果组件 -->
<template>
  <div class="docx-parser-result">
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>正在加载...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <v-alert type="error" title="解析失败" :text="error"></v-alert>
    </div>
    
    <div v-else-if="result" class="result-container">
      <!-- 文件信息 -->
      <div class="section">
        <h3>文件信息</h3>
        <div class="info-item">
          <strong>输出目录:</strong> {{ result.outputDir }}
        </div>
        <div class="info-item">
          <strong>文件数量:</strong> {{ result.fileList?.length || 0 }}
        </div>
      </div>
      
      <!-- 段落内容 -->
      <div class="section">
        <h3>文档内容 ({{ result.paragraphs?.length || 0 }}个段落)</h3>
        <div v-if="result.paragraphs && result.paragraphs.length > 0" class="paragraphs">
          <div v-for="(paragraph, index) in result.paragraphs" :key="index" class="paragraph">
            <div class="paragraph-number">{{ index + 1 }}</div>
            <div class="paragraph-content">{{ paragraph }}</div>
          </div>
        </div>
        <div v-else class="no-content">
          未提取到段落内容
        </div>
      </div>
      
      <!-- XML内容预览 -->
      <div class="section">
        <h3>XML内容预览</h3>
        <v-tabs v-model="activeTab">
          <v-tab value="document">document.xml</v-tab>
          <v-tab value="styles">styles.xml</v-tab>
          <v-tab value="contentTypes">Content_Types.xml</v-tab>
        </v-tabs>
        
        <v-window v-model="activeTab">
          <v-window-item value="document">
            <div class="xml-preview">
              <pre v-if="result.documentXml">{{ formatXml(result.documentXml) }}</pre>
              <div v-else class="no-content">无document.xml内容</div>
            </div>
          </v-window-item>
          
          <v-window-item value="styles">
            <div class="xml-preview">
              <pre v-if="result.stylesXml">{{ formatXml(result.stylesXml) }}</pre>
              <div v-else class="no-content">无styles.xml内容</div>
            </div>
          </v-window-item>
          
          <v-window-item value="contentTypes">
            <div class="xml-preview">
              <pre v-if="result.contentTypes">{{ formatXml(result.contentTypes) }}</pre>
              <div v-else class="no-content">无Content_Types.xml内容</div>
            </div>
          </v-window-item>
        </v-window>
      </div>
      
      <!-- 文件列表 -->
      <div class="section">
        <h3>文件列表</h3>
        <div v-if="result.fileList && result.fileList.length > 0" class="file-list">
          <div v-for="(file, index) in result.fileList" :key="index" class="file-item">
            {{ file }}
          </div>
        </div>
        <div v-else class="no-content">
          未找到文件列表
        </div>
      </div>
    </div>
    
    <div v-else class="no-result">
      尚未解析任何文档
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 定义组件属性
const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  result: {
    type: Object,
    default: null
  }
})

// 当前活动的XML预览标签页
const activeTab = ref('document')

// 格式化XML以便更好地显示
function formatXml(xml: string): string {
  // 简单的XML格式化，实际应用中可以使用更复杂的格式化库
  try {
    // 限制显示长度，避免渲染过多内容导致性能问题
    const maxLength = 5000
    const truncated = xml.length > maxLength ? xml.substring(0, maxLength) + '...(内容已截断)' : xml
    
    return truncated
      .replace(/></g, '>\n<')
      .replace(/<([^>]+)>/g, (match) => {
        return match.replace(/\s+/g, ' ')
      })
  } catch (error) {
    console.error('格式化XML时出错:', error)
    return xml.substring(0, 1000) + '...(内容已截断)'
  }
}
</script>

<style scoped>
.docx-parser-result {
  padding: 16px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

h2 {
  margin-bottom: 16px;
  color: #333;
}

h3 {
  margin: 16px 0 8px;
  color: #555;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.spinner {
  border: 4px solid rgba(0, 0, 0, 0.1);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border-left-color: #3498db;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.section {
  margin-bottom: 24px;
  padding: 16px;
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-item {
  margin: 8px 0;
}

.paragraphs {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.paragraph {
  display: flex;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.paragraph:last-child {
  border-bottom: none;
}

.paragraph-number {
  flex: 0 0 40px;
  font-weight: bold;
  color: #666;
}

.paragraph-content {
  flex: 1;
}

.xml-preview {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
}

.file-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.file-item {
  padding: 4px 8px;
  border-bottom: 1px solid #eee;
  font-family: monospace;
  font-size: 12px;
}

.file-item:last-child {
  border-bottom: none;
}

.no-content, .no-result {
  padding: 16px;
  color: #999;
  text-align: center;
  font-style: italic;
}

.error {
  margin: 16px 0;
}
</style> 