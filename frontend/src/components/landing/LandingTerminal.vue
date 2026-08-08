<template>
  <!--
    终端装饰窗。固定深色表面（明暗模式均保持深色终端观感），
    这是刻意的：终端在真实系统里就是深色的，跟随亮色模式反而失真。
    .terminal-container 类名为既有契约，HomeView.compact.spec.ts 依赖它判断默认首页分支。
  -->
  <div class="terminal-container" role="img" :aria-label="caption">
    <div class="terminal-window">
      <div class="terminal-header">
        <div class="terminal-buttons">
          <span class="tw-close"></span>
          <span class="tw-minimize"></span>
          <span class="tw-maximize"></span>
        </div>
        <span class="terminal-title">terminal</span>
      </div>
      <div class="terminal-body" aria-hidden="true">
        <div class="code-line line-1">
          <span class="code-prompt">$</span>
          <span class="code-cmd">curl</span>
          <span class="code-flag">-X POST</span>
          <span class="code-url">/v1/messages</span>
        </div>
        <div class="code-line line-2">
          <span class="code-comment"># {{ t('home.hero.terminalComment') }}</span>
        </div>
        <div class="code-line line-3">
          <span class="code-success">200 OK</span>
          <span class="code-response">{ "content": "Hello!" }</span>
        </div>
        <div class="code-line line-4">
          <span class="code-prompt">$</span>
          <span class="cursor"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ caption: string }>()

const { t } = useI18n()
</script>

<style scoped>
.terminal-container {
  position: relative;
  width: 100%;
  max-width: 460px;
}

.terminal-window {
  background: linear-gradient(145deg, #1c1c1e 0%, #000000 100%);
  border-radius: var(--r-lg);
  /*
    本窗体是刻意固定的深色表面，边框也必须走固定值。
    用 --separator 会让它在亮色模式下变成"黑底上的黑线"（完全看不见），
    只有暗色模式才可见——同一个装饰件不该随主题得失轮廓。
  */
  border: 0.5px solid rgba(255, 255, 255, 0.12);
  box-shadow: var(--shadow-pop), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  overflow: hidden;
  transform: perspective(1000px) rotateX(2deg) rotateY(-2deg);
  transition: transform 0.4s var(--ease);
}

.terminal-window:hover {
  transform: perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(-4px);
}

.terminal-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(28, 28, 30, 0.7);
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.06);
}

.terminal-buttons {
  display: flex;
  gap: 8px;
  flex: none;
}

.terminal-buttons span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.tw-close { background: var(--red); }
.tw-minimize { background: var(--orange); }
.tw-maximize { background: var(--green); }

.terminal-title {
  flex: 1;
  text-align: center;
  font-size: 12px;
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  color: var(--text-tertiary);
  margin-right: 52px;
}

.terminal-body {
  padding: 20px 22px;
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 13px;
  line-height: 2;
}

.code-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  opacity: 0;
  animation: lpLineAppear 0.5s var(--ease) forwards;
}

.line-1 { animation-delay: 0.3s; }
.line-2 { animation-delay: 1s; }
.line-3 { animation-delay: 1.8s; }
.line-4 { animation-delay: 2.5s; }

@keyframes lpLineAppear {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 语法高亮：全部走 iOS 语义色，在深色终端底上均可读 */
.code-prompt { color: var(--green); font-weight: 700; }
.code-cmd { color: var(--blue-ios); }
.code-flag { color: var(--purple); }
.code-url { color: var(--teal); }
.code-comment { color: var(--text-tertiary); font-style: italic; }
.code-success {
  color: var(--green);
  background: rgba(52, 199, 89, 0.16);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}
.code-response { color: var(--orange); overflow-wrap: anywhere; }

.cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--green);
  animation: lpBlink 1s step-end infinite;
}

@keyframes lpBlink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

@media (max-width: 768px) {
  .terminal-container { max-width: 100%; }
  .terminal-window { transform: none; }
  .terminal-body { padding: 16px; font-size: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .code-line { opacity: 1; animation: none; }
  .cursor { animation: none; }
  .terminal-window { transform: none; transition: none; }
}
</style>
