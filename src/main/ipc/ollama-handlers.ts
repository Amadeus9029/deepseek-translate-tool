/**
 * Ollama处理模块
 * 处理与Ollama API的交互
 */

import { ipcMain } from 'electron'
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'
import { Logger } from '../utils/logger'

/**
 * 设置Ollama处理程序
 * @param logger 日志对象
 */
export function setupOllamaHandlers(logger: Logger): void {
  // Ollama 代理处理
  ipcMain.handle('ollama-fetch', async (_, { baseUrl, path, method = 'GET', body }) => {
    return new Promise((resolve) => {
      try {
        const fullUrl = `${baseUrl}${path}`
        const url = new URL(fullUrl)
        const options = {
          hostname: url.hostname === 'localhost' ? '127.0.0.1' : url.hostname, // 强制使用 IPv4 地址
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: method,
          headers: {
            'Content-Type': 'application/json'
          },
          family: 4 // 强制使用 IPv4
        }

        const requestBody = body ? JSON.stringify(body) : undefined
        
        // 选择 http 或 https 模块
        const requestModule = url.protocol === 'https:' ? https : http
        
        logger.info(`发送请求到 ${fullUrl}`)
        if (requestBody) {
          logger.info(`请求体: ${requestBody.substring(0, 200)}...`)
        }
        
        const req = requestModule.request(options, (res) => {
          let data = ''
          
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              logger.info(`收到来自 ${fullUrl} 的响应，状态码: ${res.statusCode}`)
              logger.info(`响应数据(前200字符): ${data.substring(0, 200)}...`)
              
              // 尝试解析JSON
              try {
                const jsonData = JSON.parse(data)
                logger.info(`成功解析JSON响应`)
                resolve({ success: true, data: jsonData })
              } catch (parseErr) {
                logger.warn(`无法解析为JSON: ${parseErr}，尝试作为纯文本返回`)
                
                // 如果无法解析为JSON，则返回原始文本
                if (data && typeof data === 'string') {
                  resolve({ success: true, data: data })
                } else {
                  logger.error(`无效的响应数据`)
                  resolve({ 
                    success: false, 
                    error: '无效的响应数据',
                    rawResponse: data
                  })
                }
              }
            } catch (err) {
              logger.error(`处理响应失败: ${err}`)
              resolve({ 
                success: false, 
                error: `处理响应失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`,
                rawResponse: data
              })
            }
          })
        })
        
        req.on('error', (err) => {
          logger.error(`请求失败: ${err}`)
          resolve({ 
            success: false, 
            error: `请求失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}` 
          })
        })
        
        if (requestBody) {
          req.write(requestBody)
        }
        
        req.end()
      } catch (err) {
        logger.error(`请求异常: ${err}`)
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}` 
        })
      }
    })
  })

  // 直接从Ollama API获取模型列表
  ipcMain.handle('fetch-ollama-api-models', async () => {
    return new Promise<{success: boolean, models?: any[], error?: string}>((resolve) => {
      try {
        logger.info('开始从Ollama API获取模型列表...')
        
        // 使用预定义的模型列表
        const predefinedModels = [
          { name: 'llama3', description: 'Meta Llama 3: The most capable openly available LLM to date', tags: ['8b', '70b'] },
          { name: 'llama3.1', description: 'Llama 3.1 is a new state-of-the-art model from Meta', tags: ['8b', '70b', '405b', 'tools'] },
          { name: 'llama2', description: 'Llama 2 is a collection of foundation language models', tags: ['7b', '13b', '70b'] },
          { name: 'mistral', description: 'The 7B model released by Mistral AI', tags: ['7b', 'tools'] },
          { name: 'gemma', description: 'Gemma is a family of lightweight, state-of-the-art open models built by Google DeepMind', tags: ['2b', '7b'] },
          { name: 'gemma2', description: 'Google Gemma 2 is a high-performing and efficient model', tags: ['2b', '9b', '27b'] },
          { name: 'gemma3', description: 'The current, most capable model that runs on a single GPU', tags: ['1b', '4b', '12b', '27b', 'vision'] },
          { name: 'qwen', description: 'Qwen 1.5 is a series of large language models by Alibaba Cloud', tags: ['0.5b', '1.8b', '4b', '7b', '14b', '32b', '72b', '110b'] },
          { name: 'qwen2', description: 'Qwen2 is a new series of large language models from Alibaba group', tags: ['0.5b', '1.5b', '7b', '72b', 'tools'] },
          { name: 'qwen2.5', description: 'Qwen2.5 models are pretrained on Alibaba\'s latest large-scale dataset', tags: ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b', 'tools'] },
          { name: 'qwen3', description: 'Qwen3 is the latest generation of large language models in Qwen series', tags: ['0.6b', '1.7b', '4b', '8b', '14b', '30b', '32b', '235b', 'tools', 'thinking'] },
          { name: 'phi3', description: 'Phi-3 is a family of lightweight 3B (Mini) and 14B (Medium) state-of-the-art open models by Microsoft', tags: ['3.8b', '14b'] },
          { name: 'phi4', description: 'Phi-4 is a 14B parameter, state-of-the-art open model from Microsoft', tags: ['14b'] },
          { name: 'deepseek-r1', description: 'DeepSeek-R1 is a family of open reasoning models with performance approaching that of leading models', tags: ['1.5b', '7b', '8b', '14b', '32b', '70b', '671b', 'tools', 'thinking'] },
          { name: 'codellama', description: 'A large language model that can use text prompts to generate and discuss code', tags: ['7b', '13b', '34b', '70b'] },
          { name: 'llava', description: 'LLaVA is a novel end-to-end trained large multimodal model that combines a vision encoder and Vicuna', tags: ['7b', '13b', '34b', 'vision'] }
        ]
        
        logger.info(`成功获取 ${predefinedModels.length} 个预定义模型`)
        
        resolve({ 
          success: true, 
          models: predefinedModels
        })
      } catch (err) {
        logger.error('获取Ollama API模型列表失败:', err)
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
        })
      }
    })
  })

  // 从Ollama官方库获取模型列表
  ipcMain.handle('fetch-official-models', async () => {
    return new Promise<{success: boolean, models?: any[], error?: string, debugInfo?: any}>((resolve) => {
      try {
        logger.info('开始获取Ollama官方模型列表...')
        const options = {
          hostname: 'ollama.com',
          port: 443,
          path: '/library',
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html'
          }
        }
        
        logger.info('请求配置', options)
        
        const req = https.request(options, (res) => {
          logger.info(`收到响应状态码: ${res.statusCode}`)
          logger.info('响应头', res.headers)
          
          let data = ''
          
          res.on('data', (chunk) => {
            data += chunk
          })
          
          res.on('end', () => {
            try {
              logger.info(`收到响应数据长度: ${data.length} 字节`)
              
              // 解析HTML内容，提取模型信息
              // 尝试多种可能的模型名称匹配模式
              const nameMatches: string[] = []
              const descMatches: string[] = []
              const tagMatches: string[][] = []
              
              // 保存一小段HTML用于调试
              const htmlPreview = data.length > 5000 ? data.substring(0, 5000) + '...' : data
              logger.info('HTML样本前100个字符:', htmlPreview.substring(0, 100))
              
              // 尝试精确匹配 #repo > ul > li > a > div:nth-child(1) > h2 > div > span 结构
              const repoPattern = /<div[^>]*id="repo"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i
              const repoMatch = repoPattern.exec(data)
              
              if (repoMatch) {
                logger.info('找到了repo容器')
                const ulContent = repoMatch[1]
                
                // 从ul中提取所有li元素
                const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi
                let liMatch: RegExpExecArray | null
                const liContents: string[] = []
                
                while ((liMatch = liPattern.exec(ulContent)) !== null) {
                  liContents.push(liMatch[1])
                }
                
                logger.info(`找到了 ${liContents.length} 个li元素`)
                
                // 从每个li中提取模型名称
                for (const liContent of liContents) {
                  // 尝试匹配 a > div > h2 > div > span 结构
                  const modelNamePattern = /<a[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/i
                  const modelMatch = modelNamePattern.exec(liContent)
                  
                  if (modelMatch) {
                    const modelName = modelMatch[1].trim()
                    nameMatches.push(modelName)
                  }
                }
                
                logger.info(`从repo容器中提取到 ${nameMatches.length} 个模型名称`)
                if (nameMatches.length > 0) {
                  logger.info('模型名称:', nameMatches)
                }
              } else {
                logger.warn('未找到repo容器，尝试其他匹配模式')
              }
              
              // 如果上面的精确匹配没有结果，尝试其他模式
              if (nameMatches.length === 0) {
                // 尝试直接匹配所有 h2 > div > span 结构
                const spanPattern = /<h2[^>]*>[\s\S]*?<div[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span>/gi
                let spanMatch: RegExpExecArray | null
                
                while ((spanMatch = spanPattern.exec(data)) !== null) {
                  nameMatches.push(spanMatch[1].trim())
                }
                
                logger.info(`使用h2>div>span模式提取到 ${nameMatches.length} 个模型名称`)
                if (nameMatches.length > 0) {
                  logger.info('模型名称:', nameMatches)
                }
              }
              
              // 如果仍然没有结果，尝试更宽松的模式
              if (nameMatches.length === 0) {
                // 尝试第一种模式: <h2><div><span>模型名</span></div></h2>
                const regex1 = /<h2[^>]*><div[^>]*><span[^>]*>([^<]+)<\/span>/g
                let regexMatch1: RegExpExecArray | null
                
                while ((regexMatch1 = regex1.exec(data)) !== null) {
                  nameMatches.push(regexMatch1[1].trim())
                }
                
                logger.info(`使用第一种模式提取到 ${nameMatches.length} 个模型名称`)
                
                // 如果第一种模式没有匹配到，尝试第二种模式: <h2>模型名</h2>
                if (nameMatches.length === 0) {
                  const regex2 = /<h2[^>]*>([^<]+)<\/h2>/g
                  let regexMatch2: RegExpExecArray | null
                  
                  while ((regexMatch2 = regex2.exec(data)) !== null) {
                    nameMatches.push(regexMatch2[1].trim())
                  }
                  
                  logger.info(`使用第二种模式提取到 ${nameMatches.length} 个模型名称`)
                }
                
                // 如果第二种模式也没有匹配到，尝试第三种模式: <div class="model-name">模型名</div>
                if (nameMatches.length === 0) {
                  const regex3 = /<div[^>]*class="[^"]*model-name[^"]*"[^>]*>([^<]+)<\/div>/g
                  let regexMatch3: RegExpExecArray | null
                  
                  while ((regexMatch3 = regex3.exec(data)) !== null) {
                    nameMatches.push(regexMatch3[1].trim())
                  }
                  
                  logger.info(`使用第三种模式提取到 ${nameMatches.length} 个模型名称`)
                }
              }
              
              // 提取所有描述（如果没有描述，使用空字符串）
              const descriptionRegex = /<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/g
              let descMatch: RegExpExecArray | null
              
              while ((descMatch = descriptionRegex.exec(data)) !== null) {
                descMatches.push(descMatch[1].trim())
              }
              
              logger.info(`提取到 ${descMatches.length} 个模型描述`)
              
              // 提取所有标签组
              const tagsRegex = /<div[^>]*class="[^"]*tags[^"]*"[^>]*>(.*?)<\/div>/g
              let tagsMatch: RegExpExecArray | null
              
              while ((tagsMatch = tagsRegex.exec(data)) !== null) {
                const tagsHtml = tagsMatch[1]
                const tagList: string[] = []
                const tagItemRegex = /<div[^>]*class="[^"]*tag[^"]*"[^>]*>([^<]+)<\/div>/g
                let tagMatch: RegExpExecArray | null
                
                while ((tagMatch = tagItemRegex.exec(tagsHtml)) !== null) {
                  tagList.push(tagMatch[1].trim())
                }
                
                tagMatches.push(tagList)
              }
              
              logger.info(`提取到 ${tagMatches.length} 组标签`)
              
              // 如果没有匹配到任何模型名称，使用备用模型列表
              if (nameMatches.length === 0) {
                logger.warn('未能从HTML中提取模型名称，使用备用模型列表')
                
                // 使用备用模型列表
                const backupModels = [
                  'llama3', 'llama3.1', 'llama2', 'mistral', 'gemma', 'gemma2', 'gemma3',
                  'qwen', 'qwen2', 'qwen2.5', 'qwen3', 'phi3', 'phi4',
                  'deepseek-r1', 'codellama', 'llava'
                ]
                
                // 将备用模型添加到nameMatches
                backupModels.forEach(model => nameMatches.push(model))
              }
              
              // 组合模型信息
              const models: {name: string, description: string, tags: string[]}[] = []
              for (let i = 0; i < nameMatches.length; i++) {
                models.push({
                  name: nameMatches[i],
                  description: i < descMatches.length ? descMatches[i] : '',
                  tags: i < tagMatches.length ? tagMatches[i] : []
                })
              }
              
              logger.info(`成功组合 ${models.length} 个模型信息`)
              
              resolve({ 
                success: true, 
                models: models
              })
            } catch (err) {
              logger.error('解析响应失败:', err)
              
              resolve({ 
                success: false, 
                error: `解析响应失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
              })
            }
          })
        })
        
        req.on('error', (err) => {
          logger.error('请求失败:', err)
          resolve({ 
            success: false, 
            error: `请求失败: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
          })
        })
        
        req.end()
      } catch (err) {
        logger.error('请求异常:', err)
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
        })
      }
    })
  })

  // 获取特定模型的参数列表
  ipcMain.handle('fetch-model-params', async (_, modelName) => {
    return new Promise<{success: boolean, params?: string[], error?: string}>((resolve) => {
      try {
        logger.info(`开始获取模型 ${modelName} 的参数列表...`)
        
        // 根据模型名称提供一些常见的参数大小
        const defaultParams: Record<string, string[]> = {
          'llama3': ['8b', '70b'],
          'llama3.1': ['8b', '70b', '405b'],
          'llama2': ['7b', '13b', '70b'],
          'mistral': ['7b'],
          'gemma': ['2b', '7b'],
          'gemma2': ['2b', '9b', '27b'],
          'gemma3': ['1b', '4b', '12b', '27b'],
          'qwen': ['0.5b', '1.8b', '4b', '7b', '14b', '32b', '72b', '110b'],
          'qwen2': ['0.5b', '1.5b', '7b', '72b'],
          'qwen2.5': ['0.5b', '1.5b', '3b', '7b', '14b', '32b', '72b'],
          'qwen3': ['0.6b', '1.7b', '4b', '8b', '14b', '30b', '32b', '235b'],
          'phi3': ['3.8b', '14b'],
          'phi4': ['14b'],
          'deepseek-r1': ['8b', '7b', '14b', '32b', '70b', '1.5b', '671b'],
          'codellama': ['7b', '13b', '34b', '70b'],
          'llava': ['7b', '13b', '34b']
        }
        
        // 获取默认参数，如果没有则使用空数组
        const modelParams = defaultParams[modelName] || []
        
        logger.info(`获取到模型 ${modelName} 的参数: ${modelParams.join(', ')}`)
        
        resolve({ 
          success: true, 
          params: modelParams
        })
      } catch (err) {
        logger.error('获取模型参数失败:', err)
        resolve({ 
          success: false, 
          error: `请求异常: ${err && typeof err === 'object' && 'message' in err ? (err as any).message : String(err)}`
        })
      }
    })
  })
} 