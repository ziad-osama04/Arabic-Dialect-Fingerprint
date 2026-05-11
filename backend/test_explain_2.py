import traceback
from services.classifier import DialectClassifier
import librosa
import numpy as np
import shap

clf = DialectClassifier()
y, sr = librosa.load('../Downloaded Test Samples/EGY/1oGoj6vcKBA_segment_01.mp3', sr=None)
X_scaled, _ = clf._extract_and_scale(y, sr)
X_2d = X_scaled.reshape(1, -1)
explainer = shap.KernelExplainer(clf._model.predict_proba, clf._shap_background)
sv = explainer.shap_values(X_2d)
print("Type of sv:", type(sv))
if isinstance(sv, list):
    print("List of length:", len(sv))
    for i, item in enumerate(sv):
        print(f"  Item {i} type: {type(item)}, shape: {item.shape}")
elif isinstance(sv, np.ndarray):
    print("ndarray of shape:", sv.shape)
