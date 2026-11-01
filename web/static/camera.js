let cameraStream = null;

async function startCamera() {
    const video = document.getElementById("camera");

    if (!video) {
        console.error("Camera element not found.");
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = cameraStream;

        await video.play();

        console.log("Camera started.");
    } catch (error) {
        console.error("Camera error:", error);
        alert("Camera access failed. Please allow camera permission.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(
            track => track.stop()
        );

        cameraStream = null;
    }

    const video = document.getElementById("camera");

    if (video) {
        video.srcObject = null;
    }
}

window.addEventListener("beforeunload", () => {
    stopCamera();
});