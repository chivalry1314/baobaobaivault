import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Baobaobai Vault Docs',
  description: 'Baobaobai Vault 部署与使用操作手册',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3c3c43' }]
  ],

  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Baobaobai Vault 文档',
      description: 'Baobaobai Vault 部署与使用操作手册',
      themeConfig: {
        nav: [
          { text: '首页', link: '/' },
          { text: '部署指南', link: '/guide/deploy' },
          { text: '后端配置', link: '/backend/config' }
        ],
        sidebar: {
          '/guide/': [
            {
              text: '部署与运维',
              items: [
                { text: '部署说明', link: '/guide/deploy' },
                { text: '最小生产配置清单', link: '/guide/checklist' },
                { text: 'Public Docker 部署', link: '/guide/public-docker' }
              ]
            },
            {
              text: '功能操作手册',
              items: [
                { text: '存储到媒体上传工作流', link: '/guide/storage-workflow' }
              ]
            }
          ],
          '/backend/': [
            {
              text: '后端配置',
              items: [
                { text: '配置总览', link: '/backend/config' },
                { text: '邮箱验证码注册', link: '/backend/share-auth-email' },
                { text: '媒体文件切换到 OSS', link: '/backend/share-media-oss' }
              ]
            }
          ]
        },
        outline: {
          label: '本页目录'
        },
        docFooter: {
          prev: '上一页',
          next: '下一页'
        },
        lastUpdated: {
          text: '最后更新'
        },
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '菜单',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '多语言'
      }
    },
    en: {
      label: 'English',
      lang: 'en',
      title: 'Baobaobai Vault Docs',
      description: 'Deployment and operation manual for Baobaobai Vault',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Deployment', link: '/en/guide/deploy' },
          { text: 'Backend Config', link: '/en/backend/config' }
        ],
        sidebar: {
          '/en/guide/': [
            {
              text: 'Deployment & Operations',
              items: [
                { text: 'Deployment Guide', link: '/en/guide/deploy' },
                { text: 'Minimal Production Checklist', link: '/en/guide/checklist' },
                { text: 'Public Docker Deployment', link: '/en/guide/public-docker' }
              ]
            },
            {
              text: 'Feature Guides',
              items: [
                { text: 'Storage to Media Upload Workflow', link: '/en/guide/storage-workflow' }
              ]
            }
          ],
          '/en/backend/': [
            {
              text: 'Backend Configuration',
              items: [
                { text: 'Config Overview', link: '/en/backend/config' },
                { text: 'Email Verification', link: '/en/backend/share-auth-email' },
                { text: 'Media Storage to OSS', link: '/en/backend/share-media-oss' }
              ]
            }
          ]
        },
        outline: {
          label: 'On this page'
        }
      }
    }
  },

  themeConfig: {
    siteTitle: 'Baobaobai Vault',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜索文档',
            buttonAriaLabel: '搜索文档'
          },
          modal: {
            noResultsText: '未找到相关结果',
            resetButtonTitle: '清除搜索',
            footer: {
              selectText: '选择',
              navigateText: '切换',
              closeText: '关闭'
            }
          }
        },
        locales: {
          en: {
            translations: {
              button: {
                buttonText: 'Search docs',
                buttonAriaLabel: 'Search docs'
              },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Reset search',
                footer: {
                  selectText: 'Select',
                  navigateText: 'Navigate',
                  closeText: 'Close'
                }
              }
            }
          }
        }
      }
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/chivalry1314/baobaobaivault' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Baobaobai Vault'
    }
  }
})
