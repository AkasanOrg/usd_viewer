import { useCallback, useState, useRef } from 'react';
import { UsdaEditor } from './components/UsdaEditor';
import { UsdViewer } from './components/UsdViewer';
import { FileToolbar, downloadAsFile } from './components/FileToolbar';
import { useVideoRecorder } from './hooks/useVideoRecorder';
import './App.css';

const DEFAULT_USDA_CONTENT = `#usda 1.0
(
    defaultPrim = "World"
    startTimeCode = 0
    endTimeCode = 48
)

def Xform "World"
{
    def Sphere "AnimatedSphere"
    {
        double radius.timeSamples = {
            0: 0.5,
            24: 1.5,
            48: 0.5,
        }
        double3 xformOp:translate.timeSamples = {
            0: (0, 0, 0),
            24: (2, 1, 0),
            48: (0, 0, 0),
        }
        color3f[] primvars:displayColor = [(1.0, 0.3, 0.2)]
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }

    def Cube "StaticCube"
    {
        double size = 0.5
        double3 xformOp:translate = (-2, 0, 0)
        color3f[] primvars:displayColor = [(0.2, 0.6, 1.0)]
        uniform token[] xformOpOrder = ["xformOp:translate"]
    }
}
`;

function App() {
  const [usdaContent, setUsdaContent] = useState(DEFAULT_USDA_CONTENT);
  const [currentFilename, setCurrentFilename] = useState('scene.usda');
  const [isRecording, setIsRecording] = useState(false);
  const [animationInfo, setAnimationInfo] = useState({
    hasAnimation: false,
    startFrame: 0,
    endFrame: 0,
    currentFrame: 0,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { startRecording, stopRecording } = useVideoRecorder({
    fps: 24,
    filename: currentFilename.replace(/\.(usda?|usd)$/i, '.webm'),
  });

  const handleSave = useCallback((content: string) => {
    setUsdaContent(content);
  }, []);

  const handleChange = useCallback((content: string | undefined) => {
    if (content !== undefined) {
      setUsdaContent(content);
    }
  }, []);

  const handleImport = useCallback((content: string, filename: string) => {
    setUsdaContent(content);
    setCurrentFilename(filename);
  }, []);

  const handleExport = useCallback(() => {
    downloadAsFile(usdaContent, currentFilename);
  }, [usdaContent, currentFilename]);

  const handleCanvasReady = useCallback((canvas: HTMLCanvasElement) => {
    canvasRef.current = canvas;
  }, []);

  const handleRecordVideo = useCallback(() => {
    if (canvasRef.current && animationInfo.hasAnimation) {
      setIsRecording(true);
      startRecording(canvasRef.current);
    }
  }, [animationInfo.hasAnimation, startRecording]);

  const handleRecordingComplete = useCallback(() => {
    stopRecording();
    setIsRecording(false);
  }, [stopRecording]);

  const handleAnimationInfo = useCallback((info: typeof animationInfo) => {
    setAnimationInfo(info);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>USD Viewer</h1>
        <FileToolbar
          currentFilename={currentFilename}
          onImport={handleImport}
          onExport={handleExport}
          onRecordVideo={handleRecordVideo}
          hasAnimation={animationInfo.hasAnimation}
          isRecording={isRecording}
          recordingProgress={
            isRecording
              ? {
                  current: Math.round(animationInfo.currentFrame),
                  total: animationInfo.endFrame,
                }
              : undefined
          }
        />
      </header>
      <main className="main-container">
        <div className="editor-panel">
          <UsdaEditor
            initialValue={DEFAULT_USDA_CONTENT}
            onSave={handleSave}
            onChange={handleChange}
          />
        </div>
        <div className="viewer-panel">
          <UsdViewer
            usdaContent={usdaContent}
            onCanvasReady={handleCanvasReady}
            isRecording={isRecording}
            onRecordingComplete={handleRecordingComplete}
            onAnimationInfo={handleAnimationInfo}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
