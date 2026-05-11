import traceback
from services.classifier import DialectClassifier
import librosa

clf = DialectClassifier()
y, sr = librosa.load('../Downloaded Test Samples/EGY/1oGoj6vcKBA_segment_01.mp3', sr=None)
try:
    clf.explain(y, sr)
    print('SUCCESS')
except Exception as e:
    traceback.print_exc()
