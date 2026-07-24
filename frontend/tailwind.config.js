/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调 - Apple System Blue（替换上游 Teal，键名全站硬依赖，只改值）
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#3b9dff',
          500: '#0071e3', // apple.com 按钮蓝
          600: '#0a84ff', // iOS 系统蓝（暗色抬升）
          700: '#0060c0',
          800: '#004a99',
          900: '#003a78',
          950: '#00274d'
        },
        // 辅助色 - Apple 中性灰（去 slate 蓝调，键名不动）
        accent: {
          50: '#f5f5f7', // apple.com 浅背景
          100: '#e8e8ed',
          200: '#d2d2d7',
          300: '#b0b0b8',
          400: '#86868b',
          500: '#6e6e73',
          600: '#48484a',
          700: '#363638',
          800: '#242426',
          900: '#161618',
          950: '#000000'
        },
        // 深色模式背景 - Apple 三级灰阶（键名全站硬依赖，只改值）
        dark: {
          50: '#f5f5f7',
          100: '#e8e8ed',
          200: '#d2d2d7',
          300: '#aeaeb2', // 次要文本
          400: '#8e8e93', // 占位/弱文本
          500: '#636366',
          600: '#48484a', // 边框/hover
          700: '#38383a', // 边框/分隔
          800: '#2c2c2e', // L2 抬升面
          900: '#1c1c1e', // L1 控件/侧栏
          950: '#000000' // L0 纯黑背景
        }
      },
      fontFamily: {
        sans: [
          'SF Pro Text',
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
        glass: '0 8px 32px rgba(0, 0, 0, 0.08)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.06)',
        glow: '0 0 20px rgba(0, 113, 227, 0.25)',
        'glow-lg': '0 0 40px rgba(0, 113, 227, 0.35)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 40px rgba(0, 0, 0, 0.08)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        // 主渐变改扁平实色感（苹果按钮非渐变），仍保留键名给旧引用
        'gradient-primary': 'linear-gradient(180deg, #0a84ff 0%, #0071e3 100%)',
        'gradient-dark': 'linear-gradient(180deg, #1c1c1e 0%, #000000 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        // 8️⃣老师明确拒绝"意义不明的 mesh 渐变"；键名保留但置空
        'mesh-gradient': 'none'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
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
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(0, 113, 227, 0.25)' },
          '100%': { boxShadow: '0 0 30px rgba(0, 113, 227, 0.4)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderRadius: {
        '4xl': '2rem'
      },
      transitionTimingFunction: {
        // Apple 系统级缓动（apple.com / iOS 弹性感，无 keyframe 弹簧时的近似）
        apple: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'apple-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'apple-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'apple-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      transitionDuration: {
        250: '250ms',
        350: '350ms',
        400: '400ms'
      }
    }
  },
  plugins: []
}
