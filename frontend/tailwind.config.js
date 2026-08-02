/** @type {import('tailwindcss').Config} */

/*
 * Apple Design System / Liquid Glass (iOS 27) palette.
 *
 * The panel has ~10k hardcoded palette utilities in templates
 * (text-gray-* alone appears 4429 times). Rewriting them per-file is not
 * viable, so the palette definitions themselves are remapped to Apple
 * system colors. Existing classes like `text-gray-500` or `dark:bg-dark-800`
 * keep their exact spelling in templates and resolve to the new material
 * colors automatically.
 *
 * Mapping contract for the neutral ramps:
 *   gray-50..400  -> label hierarchy (text) + lightest fills
 *   gray-500..950 -> surfaces, separators, sunken backgrounds
 *   dark-*        -> dark-mode counterpart of the same ramp
 */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色调 - Apple 系统蓝 (light #007aff / dark #0a84ff)
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#7cc0ff',
          400: '#409cff',
          500: '#0a84ff',
          600: '#007aff',
          700: '#0071eb',
          800: '#0062cc',
          900: '#0a4da8',
          950: '#062f66'
        },
        // 辅助色 - Apple 中性灰阶（与 gray 同源，保留既有 accent-* 用法）
        accent: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#2c2c2e',
          950: '#1c1c1e'
        },
        // 深色模式表面阶梯 - Apple elevated surfaces
        dark: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#48484a',
          700: '#38383a',
          800: '#2c2c2e',
          900: '#1c1c1e',
          950: '#0b0b0d'
        },
        // Apple 中性灰阶 - 覆盖 Tailwind 默认 gray
        gray: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#1c1c1e',
          950: '#0b0b0d'
        },
        // ---- Apple 系统语义色 ----
        // 保留色相家族，换成 Apple 对应系统色；语义不变。
        green: {
          50: '#eefdf2',
          100: '#d6f8e0',
          200: '#a7efbf',
          300: '#6ae07f',
          400: '#30d158',
          500: '#34c759',
          600: '#248a3d',
          700: '#1c6e30',
          800: '#175827',
          900: '#124520',
          950: '#062810'
        },
        emerald: {
          50: '#effdf8',
          100: '#d7f9ee',
          200: '#a6f0dc',
          300: '#63e6e2',
          400: '#00c7be',
          500: '#00b3ab',
          600: '#0d8f89',
          700: '#12726e',
          800: '#125c59',
          900: '#104845',
          950: '#052a29'
        },
        red: {
          50: '#fff1f0',
          100: '#ffdfdc',
          200: '#ffc0ba',
          300: '#ff9d94',
          400: '#ff453a',
          500: '#ff3b30',
          600: '#d70015',
          700: '#b00012',
          800: '#8f0310',
          900: '#750912',
          950: '#400105'
        },
        orange: {
          50: '#fff7ed',
          100: '#ffeed4',
          200: '#ffd9a8',
          300: '#ffb340',
          400: '#ff9f0a',
          500: '#ff9500',
          600: '#c76b00',
          700: '#9c5502',
          800: '#7c4308',
          900: '#67390b',
          950: '#3b1d02'
        },
        amber: {
          50: '#fffbeb',
          100: '#fff5c9',
          200: '#ffe990',
          300: '#ffd60a',
          400: '#ffcc00',
          500: '#eaba00',
          600: '#c79a00',
          700: '#9e7a02',
          800: '#825f08',
          900: '#6e4f0b',
          950: '#402c02'
        },
        yellow: {
          50: '#fffbeb',
          100: '#fff5c9',
          200: '#ffe990',
          300: '#ffd60a',
          400: '#ffcc00',
          500: '#eaba00',
          600: '#c79a00',
          700: '#9e7a02',
          800: '#825f08',
          900: '#6e4f0b',
          950: '#402c02'
        },
        blue: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#7cc0ff',
          400: '#409cff',
          500: '#0a84ff',
          600: '#007aff',
          700: '#0071eb',
          800: '#0062cc',
          900: '#0a4da8',
          950: '#062f66'
        },
        cyan: {
          50: '#ecfbff',
          100: '#d3f4ff',
          200: '#a9e9ff',
          300: '#64d2ff',
          400: '#32ade6',
          500: '#1f9dd4',
          600: '#127ead',
          700: '#12658b',
          800: '#145372',
          900: '#134560',
          950: '#062a3d'
        },
        teal: {
          50: '#effcfd',
          100: '#d3f6f9',
          200: '#abecf2',
          300: '#40c8e0',
          400: '#30b0c7',
          500: '#2496ab',
          600: '#1f7f92',
          700: '#1e6676',
          800: '#1e5561',
          900: '#1c4652',
          950: '#0a2b34'
        },
        indigo: {
          50: '#f0f0ff',
          100: '#e3e3ff',
          200: '#cacaff',
          300: '#a9a8ff',
          400: '#5e5ce6',
          500: '#5856d6',
          600: '#4644bd',
          700: '#3b3a9e',
          800: '#32317f',
          900: '#2c2b66',
          950: '#1b1a3d'
        },
        purple: {
          50: '#fbf4ff',
          100: '#f5e6ff',
          200: '#ebd0ff',
          300: '#dcaeff',
          400: '#bf5af2',
          500: '#af52de',
          600: '#8944ab',
          700: '#71388c',
          800: '#5d2f73',
          900: '#4d285f',
          950: '#2e1339'
        },
        violet: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#bf5af2',
          500: '#af52de',
          600: '#8944ab',
          700: '#71388c',
          800: '#5d2f73',
          900: '#4d285f',
          950: '#2e1339'
        },
        pink: {
          50: '#fff1f4',
          100: '#ffe0e7',
          200: '#ffc6d3',
          300: '#ff9db4',
          400: '#ff375f',
          500: '#ff2d55',
          600: '#d81b41',
          700: '#b31536',
          800: '#951531',
          900: '#7d152e',
          950: '#450816'
        },
        rose: {
          50: '#fff1f4',
          100: '#ffe0e7',
          200: '#ffc6d3',
          300: '#ff9db4',
          400: '#ff375f',
          500: '#ff2d55',
          600: '#d81b41',
          700: '#b31536',
          800: '#951531',
          900: '#7d152e',
          950: '#450816'
        },
        // 中性别名 - 与 gray 同源，覆盖模板里零散的 slate/zinc/neutral/stone
        slate: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#1c1c1e',
          950: '#0b0b0d'
        },
        zinc: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#1c1c1e',
          950: '#0b0b0d'
        },
        neutral: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#1c1c1e',
          950: '#0b0b0d'
        },
        stone: {
          50: '#f9f9fb',
          100: '#f2f2f7',
          200: '#e5e5ea',
          300: '#d1d1d6',
          400: '#aeaeb2',
          500: '#8e8e93',
          600: '#636366',
          700: '#48484a',
          800: '#3a3a3c',
          900: '#1c1c1e',
          950: '#0b0b0d'
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
      // 高程阴影：大表面更"厚" = 更强模糊 + 更深阴影
      boxShadow: {
        'elev-1': 'var(--shadow-1)',
        'elev-2': 'var(--shadow-2)',
        'elev-3': 'var(--shadow-3)',
        'elev-4': 'var(--shadow-4)',
        glass: 'var(--shadow-3)',
        'glass-sm': 'var(--shadow-2)',
        glow: 'var(--shadow-accent)',
        'glow-lg': 'var(--shadow-accent)',
        card: 'var(--shadow-2)',
        'card-hover': 'var(--shadow-3)',
        'inner-glow': 'inset 0 1px 0 var(--glass-specular)',
        // iOS 27 四层玻璃边缘：外发丝线 → 内深色轮廓 → 底部反射光 → 顶部镜面高光
        'glass-edge':
          '0 0 0 0.5px var(--glass-edge-outer), inset 0 0 0 0.5px var(--glass-edge), inset 0 -1px 0 0 var(--glass-counter), inset 0 1px 0 0 var(--glass-specular), var(--shadow-3)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(145deg, var(--accent) 0%, #0a5fd0 100%)',
        'gradient-dark': 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 100%)',
        'gradient-glass':
          'linear-gradient(142deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 22%, transparent 46%)',
        // Ambient 光层：玻璃需要有东西可折射，纯灰/纯黑会让 backdrop-filter 空转
        'mesh-gradient': 'var(--ambient-wash)'
      },
      backdropBlur: {
        xs: '2px',
        thin: 'var(--mat-blur-thin)',
        regular: 'var(--mat-blur-regular)',
        thick: 'var(--mat-blur-thick)'
      },
      backgroundColor: {
        'mat-thin': 'var(--mat-thin)',
        'mat-regular': 'var(--mat-regular)',
        'mat-thick': 'var(--mat-thick)',
        surface: 'var(--surface)',
        'surface-secondary': 'var(--surface-secondary)'
      },
      transitionTimingFunction: {
        spring: 'var(--spring)',
        'spring-bounce': 'var(--spring-bounce)',
        'apple-out': 'var(--ease-out)'
      },
      transitionDuration: {
        instant: '100ms',
        fast: '240ms',
        base: '340ms',
        slow: '440ms'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.34s var(--spring)',
        'slide-down': 'slideDown 0.34s var(--spring)',
        'slide-in-right': 'slideInRight 0.34s var(--spring)',
        'scale-in': 'scaleIn 0.24s var(--spring)',
        materialize: 'materialize 0.44s var(--spring)',
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
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        // Materialize：玻璃表面进场时 blur 与 scale 同时动，读作真实材质到达
        materialize: {
          '0%': { opacity: '0', transform: 'scale(0.94) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 4px 14px -2px rgba(0, 122, 255, 0.32)' },
          '100%': { boxShadow: '0 6px 20px -2px rgba(0, 122, 255, 0.46)' }
        }
      },
      // 连续圆角阶梯（近似 squircle：嵌套时外圆角 = 内圆角 + 间距）
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '26px',
        '4xl': '32px'
      }
    }
  },
  plugins: []
}
