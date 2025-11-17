import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
} from "react";
// REMOVED: Firebase-related imports
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import SearchIcon from "../icons/SearchIcon";
import CameraIcon from "../icons/CameraIcon";

export type PhotoUploadData = { imageUrl: string };
type Props = {
  onSubmit: (data: PhotoUploadData) => void;
  onError?: (msg: string | null) => void;
  initialData?: Partial<PhotoUploadData>;
};

// --- WebcamCapture component remains exactly the same ---
const WebcamCapture = ({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        onCancel();
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onCancel]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `webcam-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      }
    }, "image/jpeg");
  };

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full max-w-md rounded-lg"
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCapture}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Capture
        </button>
      </div>
    </div>
  );
};

// --- Main Photo Upload Form ---
const PhotoUploadForm = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError, initialData = {} }, ref) => {
    const [view, setView] = useState<"initial" | "preview" | "webcam">(
      "initial"
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(
      initialData.imageUrl ?? null
    );
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
      if (initialData.imageUrl) {
        setView("preview");
      }
    }, [initialData.imageUrl]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          onError?.("File is too large. Please select an image under 2MB.");
          return;
        }
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setView("preview");
        onError?.(null);
      }
    };

    const handleWebcamCapture = (file: File) => {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setView("preview");
    };

    // MODIFIED: This function now simulates an upload.
    const handleUpload = () => {
      if (imageFile) {
        // Simulate the upload process
        setIsUploading(true);
        setUploadProgress(0);

        // Animate the progress bar over 1.5 seconds
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 99) {
              clearInterval(interval);
              return 100;
            }
            return prev + 10;
          });
        }, 150);

        // Simulate the completion of the upload
        setTimeout(() => {
          clearInterval(interval);
          setUploadProgress(100);
          setIsUploading(false);
          // On success, submit the temporary blob URL for the preview.
          onSubmit({ imageUrl: previewUrl! });
        }, 1500);
      } else if (previewUrl) {
        // If a photo exists from initialData but wasn't changed, just proceed.
        onSubmit({ imageUrl: previewUrl });
      } else {
        // If no photo was selected, submit an empty string.
        onSubmit({ imageUrl: "" });
      }
    };

    useImperativeHandle(ref, () => ({ submit: handleUpload }));

    return (
      <div className="space-y-4">
        <h1 className="text-xl font-medium text-gray-800">
          Upload a photo of the recipient
        </h1>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
          {/* --- The entire JSX remains exactly the same --- */}

          {view === "initial" && (
            <div className="text-center space-y-4">
              <p className="font-semibold">Browse a file or use webcam</p>
              <p className="text-sm text-gray-500">
                PNG and JPEG formats, up to 2 MB
              </p>
              <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto my-4"></div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <SearchIcon className="w-5 h-5" />
                  <span>Browse</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("webcam")}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <CameraIcon className="w-5 h-5" />
                  <span>Camera</span>
                </button>
              </div>
            </div>
          )}

          {view === "preview" && (
            <div className="text-center space-y-4">
              <div className="relative w-48 h-48">
                {isUploading && (
                  <div className="absolute inset-0">
                    <CircularProgressbar
                      value={uploadProgress}
                      text={`${uploadProgress}%`}
                      styles={buildStyles({
                        pathColor: "#3B82F6",
                        textColor: "#3B82F6",
                      })}
                    />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl!}
                  alt="Recipient Preview"
                  className={`w-full h-full object-cover rounded-full ${
                    isUploading ? "opacity-30" : ""
                  }`}
                />
              </div>
              {!isUploading && (
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-primary hover:underline"
                  >
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setPreviewUrl(null);
                      setView("initial");
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "webcam" && (
            <WebcamCapture
              onCapture={handleWebcamCapture}
              onCancel={() => setView("initial")}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  }
);

PhotoUploadForm.displayName = "PhotoUploadForm";
export default PhotoUploadForm;
