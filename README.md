# AI Tester for Obsidian

AI Tester는 옵시디언(Obsidian) 내에서 다양한 AI 모델과 프롬프트를 빠르고 효율적으로 테스트할 수 있도록 설계된 플러그인입니다. Ollama(로컬) 및 OpenAI와 같은 다양한 프로바이더를 지원하며, 코드 블록 내에서 직접 상호작용하고 결과를 기록할 수 있습니다.

## ✨ 주요 기능

- **멀티 프로바이더 지원**: Ollama(로컬 LLM) 및 OpenAI 모델을 지원합니다.
- **전용 코드 블록**: ` ```ai-tester ` 블록을 사용하여 노드 내 어디서든 AI와 대화할 수 있습니다.
- **YAML 설정 지원**: 모델, 온도로(Temperature), 최대 토큰 수 등 상세 설정을 YAML 형식으로 블록마다 다르게 설정할 수 있습니다.
- **포커스 안정성**: 입력 중 자동 저장을 비활성화하고, 포커스를 잃을 때(Blur)나 수동 저장 시에만 파일이 업데이트되어 끊김 없는 작성이 가능합니다.
- **응답 통계**: AI 응답 시 소요 시간 및 사용된 토큰 수를 실시간으로 확인할 수 있습니다.
- **다중 응답 생성**: 하나의 프롬프트에 대해 여러 개의 응답을 동시에 생성하여 비교할 수 있습니다.

## 🚀 시작하기

### 설치 방법

#### 1. 간단 설치 명령어 (Release 파일만 다운로드)
터미널을 열고 옵시디언 보관소(Vault)의 플러그인 폴더로 이동한 뒤 아래 명령어를 실행하세요. (GitHub에 `main.js`, `manifest.json`, `styles.css` 파일이 루트에 있어야 합니다.)

```bash
mkdir -p .obsidian/plugins/ai-tester && cd .obsidian/plugins/ai-tester && \
curl -O https://raw.githubusercontent.com/wis-graph/obsidian-ai-tester/main/manifest.json && \
curl -O https://raw.githubusercontent.com/wis-graph/obsidian-ai-tester/main/main.js && \
curl -O https://raw.githubusercontent.com/wis-graph/obsidian-ai-tester/main/styles.css && \
curl -O https://raw.githubusercontent.com/wis-graph/obsidian-ai-tester/main/data.json
```
*(참고: `data.json`은 기본 설정값이 포함되어 있으며, 설치 후 플러그인 설정 창에서 사용자에게 맞게 수정할 수 있습니다.)*

#### 2. 소스코드 빌드 설치
1. 이 레포지토리를 클론합니다.
2. `npm install`을 실행하여 의존성을 설치합니다.
3. `npm run build`를 실행하여 빌드합니다.
4. 생성된 `main.js`, `manifest.json`, `styles.css` 파일을 `.obsidian/plugins/ai-tester/` 폴더에 복사합니다.

## 📝 사용법

노드 안에 아래와 같이 코드 블록을 작성하세요:

<pre>
```ai-tester
---
model: llama3
temperature: 0.7
num_responses: 2
---
오늘 날씨에 대해 시 한 편 써줘.
```
</pre>

- `---` 사이의 YAML 설정은 생략 가능하며, 설정하지 않을 경우 플러그인 기본 설정값이 적용됩니다.
- 입력창 오른쪽 하단의 버튼들을 사용하여 **복사**, **저장**, **지우기**, **전송** 기능을 사용할 수 있습니다.
- `Ctrl+S` (또는 `Cmd+S`) 단축키로 프롬프트를 즉시 저장할 수 있습니다.

## ⚙️ 설정

옵시디언 설정 창의 **AI Tester** 탭에서 다음을 설정할 수 있습니다:
- Ollama 서버 URL 및 기본 모델
- OpenAI API 키 및 모델 선택
- 활성화할 프로바이더 선택

---

### License
MIT License.
