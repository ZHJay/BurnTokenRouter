/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 品牌主色 - Apple Blue（apple.com 按钮蓝 / iOS 系统蓝）
        // 锚点：primary-400 ≈ #0a84ff（暗色模式品牌蓝，dark:text-primary-400 全站主力）
        //       primary-500 = #0071e3（亮色品牌蓝）· primary-600 = #0060c0（--blue-hover）
        primary: {
          50: '#eaf4ff',
          100: '#d3e9ff',
          200: '#b2d9ff',
          300: '#3b9dff',
          400: '#0a84ff',
          500: '#0071e3',
          600: '#0060c0',
          700: '#0051a5',
          800: '#004186',
          900: '#003166',
          950: '#001d3d'
        },
        // 深色模式中性色 - iOS 系统表面与标签灰
        // 表面：dark-800 #1c1c1e（浮起卡片/模态）· dark-900/950 #000000（基底）
        // 文字：dark-400 #aeaeb2（次级标签）· dark-500 #8e8e93（三级标签）
        dark: {
          50: '#ffffff',
          100: '#f5f5f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#3a3a3c',
          800: '#1c1c1e',
          900: '#000000',
          950: '#000000'
        },
        // iOS 语义色（锚定 500；400 为暗色模式更亮档，供 dark:text-*-400 使用）
        emerald: {
          50: '#f0faf4',
          100: '#d8f5e2',
          200: '#b3ebc8',
          300: '#82dfa8',
          400: '#55d186',
          500: '#34c759',
          600: '#28a745',
          700: '#1f8a3a',
          800: '#17692c',
          900: '#0f4a20',
          950: '#082d13'
        },
        green: {
          50: '#f0faf4',
          100: '#d8f5e2',
          200: '#b3ebc8',
          300: '#82dfa8',
          400: '#55d186',
          500: '#34c759',
          600: '#28a745',
          700: '#1f8a3a',
          800: '#17692c',
          900: '#0f4a20',
          950: '#082d13'
        },
        red: {
          50: '#fff0ef',
          100: '#ffdcd9',
          200: '#ffb8b3',
          300: '#ff8f88',
          400: '#ff453a',
          500: '#ff3b30',
          600: '#e02d22',
          700: '#bd241b',
          800: '#961c15',
          900: '#6e1410',
          950: '#460c09'
        },
        orange: {
          50: '#fff9ef',
          100: '#ffeed1',
          200: '#ffdc9e',
          300: '#ffc663',
          400: '#ffb340',
          500: '#ff9f0a',
          600: '#e08b00',
          700: '#b86f00',
          800: '#8e5500',
          900: '#653c00',
          950: '#3d2400'
        },
        amber: {
          50: '#fff9ef',
          100: '#ffeed1',
          200: '#ffdc9e',
          300: '#ffc663',
          400: '#ffb340',
          500: '#ff9f0a',
          600: '#e08b00',
          700: '#b86f00',
          800: '#8e5500',
          900: '#653c00',
          950: '#3d2400'
        },
        purple: {
          50: '#fbf1fd',
          100: '#f5ddfb',
          200: '#ecbaf7',
          300: '#e093f2',
          400: '#bf5af2',
          500: '#af52de',
          600: '#9343c0',
          700: '#77349d',
          800: '#5b2779',
          900: '#3f1a56',
          950: '#250e33'
        },
        violet: {
          50: '#fbf1fd',
          100: '#f5ddfb',
          200: '#ecbaf7',
          300: '#e093f2',
          400: '#bf5af2',
          500: '#af52de',
          600: '#9343c0',
          700: '#77349d',
          800: '#5b2779',
          900: '#3f1a56',
          950: '#250e33'
        },
        teal: {
          50: '#effbfd',
          100: '#d4f3f8',
          200: '#a9e7f1',
          300: '#78d5e6',
          400: '#4cc2d8',
          500: '#30b0c7',
          600: '#2494a9',
          700: '#1c7687',
          800: '#155a67',
          900: '#0e3f48',
          950: '#072629'
        },
        blue: {
          50: '#eaf4ff',
          100: '#d3e9ff',
          200: '#b2d9ff',
          300: '#3b9dff',
          400: '#0a84ff',
          500: '#0071e3',
          600: '#0060c0',
          700: '#0051a5',
          800: '#004186',
          900: '#003166',
          950: '#001d3d'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        // 引用 CSS 变量：随 html.dark 自动切换亮/暗阴影
        glass: 'var(--glass-highlight), var(--shadow-pop)',
        card: 'var(--shadow-card)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      // iOS 弹簧动效扩展：ease-spring / duration-400 / duration-450
      transitionTimingFunction: {
        spring: 'var(--ease)'
      },
      transitionDuration: {
        400: '400ms',
        450: '450ms'
      }
    }
  },
  plugins: []
}
