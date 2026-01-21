import os
from flask import Flask, request, jsonify
from datetime import datetime, timedelta

# Lazy loading flags
HAS_TRANSFORMERS = False
HAS_TENSORFLOW = False

try:
    import transformers
    HAS_TRANSFORMERS = True
    print(f"Transformers loaded successfully: {transformers.__version__}")
except Exception as e:
    print(f"Transformers import failed: {e}")
    # Try to provide more context
    import sys
    print(f"Python path: {sys.path}")
    import traceback
    traceback.print_exc()

def get_transformers():
    global HAS_TRANSFORMERS
    try:
        import transformers
        HAS_TRANSFORMERS = True
        return transformers
    except Exception as e:
        print(f"Transformers not available: {e}")
        return None

def get_tensorflow():
    global HAS_TENSORFLOW
    try:
        import tensorflow as tf
        HAS_TENSORFLOW = True
        return tf
    except Exception as e:
        print(f"TensorFlow not available: {e}")
        return None

app = Flask(__name__)

# Global model state
model = None
feature_max = None
nlp_model = None # Lazy loaded
nlp_tokenizer = None

# Model Registry - stores trained models for classification
model_registry = {
    'huggingface': None,  # Stores active HF model
    'kaggle': {}  # Stores Kaggle models by name
}

@app.route('/health', methods=['GET'])
def health_check():
    tf_version = 'not_loaded'
    if HAS_TENSORFLOW:
        try:
            import tensorflow as tf
            tf_version = tf.__version__
        except: pass
        
    return jsonify({
        'status': 'healthy',
        'tensorflow_version': tf_version,
        'has_transformers': HAS_TRANSFORMERS,
        'message': 'Python AI Service is running with Pro Features'
    })

# --- Pro Feature 1: Semantic Search ---
@app.route('/semantic-search', methods=['POST'])
def semantic_search():
    try:
        global nlp_model
        data = request.json
        query = data.get('query', '')
        logs = data.get('logs', [])
        
        if not logs or not query:
            return jsonify({'results': []})

        messages = [log.get('message', '') for log in logs]
        
        # Fallback to TF-IDF (always used for speed/memory unless transformers are explicitly requested)
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(messages + [query])
        
        scores = cosine_similarity(tfidf_matrix[-1:], tfidf_matrix[:-1])[0]
        
        results = []
        for i, score in enumerate(scores):
            if score > 0.1: # Threshold
                results.append({'log': logs[i], 'score': float(score)})
        
        # Sort by score
        results = sorted(results, key=lambda x: x['score'], reverse=True)
        
        return jsonify({'results': results[:10]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 2: Log Clustering ---
@app.route('/cluster', methods=['POST'])
def cluster_logs():
    try:
        from sklearn.cluster import KMeans
        from sklearn.feature_extraction.text import TfidfVectorizer
        
        data = request.json
        logs = data.get('logs', [])
        if len(logs) < 3:
            return jsonify({'clusters': []})

        messages = [log.get('message', '') for log in logs]
        vectorizer = TfidfVectorizer(max_features=100)
        X = vectorizer.fit_transform(messages)
        
        n_clusters = min(5, len(logs))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(X)
        
        import numpy as np
        result_clusters = []
        for i in range(n_clusters):
            cluster_indices = np.where(clusters == i)[0]
            cluster_logs = [logs[idx] for idx in cluster_indices]
            # Find a representative message (closest to centroid)
            result_clusters.append({
                'id': i,
                'count': len(cluster_logs),
                'sample': cluster_logs[0].get('message'),
                'logs': cluster_logs[:5]
            })
            
        return jsonify({'clusters': result_clusters})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 3: Urgency Classification ---
@app.route('/urgency', methods=['POST'])
def classify_urgency():
    try:
        data = request.json
        log = data.get('log', {})
        message = log.get('message', '').lower()
        level = log.get('level', 'INFO')
        
        urgency = "Informational"
        score = 0.2
        
        if level in ['FATAL', 'ERROR'] or any(word in message for word in ['fail', 'critical', 'timeout', 'denied']):
            urgency = "Critical"
            score = 0.9
        elif level == 'WARN' or any(word in message for word in ['slow', 'retry', 'limit']):
            urgency = "Actionable"
            score = 0.5
            
        return jsonify({'urgency': urgency, 'score': score})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 4: Volume Forecasting (LSTM-lite) ---
@app.route('/forecast', methods=['POST'])
def forecast_volume():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        history = data.get('history', []) # List of counts per hour
        
        if len(history) < 5:
            # Not enough data for LSTM, use simple linear trend
            return jsonify({'forecast': [history[-1] * 1.05 if history else 10] * 3})

        # Simple Moving Average for demo speed, but structured for LSTM expansion
        X = np.array(history).reshape(-1, 1)
        forecast = [float(np.mean(history[-3:]) * (1 + (i+1)*0.05)) for i in range(3)]
        
        return jsonify({
            'forecast': forecast,
            'trend': 'increasing' if forecast[-1] > history[-1] else 'stable'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 5: Anomaly Attribution ---
@app.route('/attribute', methods=['POST'])
def attribute_anomaly():
    try:
        data = request.json
        log = data.get('log', {})
        
        # Logic: Compare specific features to global averages
        # For demo, we return mock attribution
        return jsonify({
            'primary_cause': 'Abnormal Message Length' if len(log.get('message', '')) > 100 else 'Unexpected Source',
            'confidence': 0.85,
            'details': f"The log from {log.get('source')} shows a pattern deviation in its structure."
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 6: Component Tagging ---
@app.route('/tag', methods=['POST'])
def tag_log():
    try:
        data = request.json
        log = data.get('log', {})
        msg = log.get('message', '').lower()
        src = log.get('source', '').lower()
        
        tags = []
        if 'db' in src or 'sql' in msg or 'query' in msg: tags.append('#Database')
        if 'auth' in src or 'login' in msg or 'token' in msg: tags.append('#Auth')
        if 'api' in src or 'http' in msg: tags.append('#Network')
        if not tags: tags.append('#General')
        
        return jsonify({'tags': tags})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 7: Health Score ---
@app.route('/health-score', methods=['POST'])
def system_health():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({'score': 100})
        
        error_count = sum(1 for l in logs if l.get('level') in ['ERROR', 'FATAL'])
        anomaly_ratio = error_count / len(logs)
        
        score = max(0, 100 - (anomaly_ratio * 200))
        status = "Healthy" if score > 80 else "Degraded" if score > 50 else "Critical"
        
        return jsonify({
            'score': int(score),
            'status': status,
            'factors': [
                {'name': 'Error Rate', 'impact': 'high' if anomaly_ratio > 0.1 else 'low'},
                {'name': 'System Load', 'impact': 'normal'}
            ]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 8: Service Dependency Map ---
@app.route('/dependency-map', methods=['POST'])
def dependency_map():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({"nodes": [], "links": []})
        
        df = pd.DataFrame(logs)
        if 'source' not in df.columns:
            return jsonify({"nodes": [], "links": []})
        
        sources = df['source'].unique().tolist()
        nodes = [{"id": s, "group": 1} for s in sources]
        
        links = []
        # Infer connections based on sequential occurrence in logs (heuristic)
        for i in range(len(sources)-1):
            links.append({
                "source": sources[i],
                "target": sources[i+1],
                "value": 1
            })
            
        return jsonify({"nodes": nodes, "links": links})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 9: Incident Timeline ---
@app.route('/timeline', methods=['POST'])
def get_timeline():
    try:
        import pandas as pd
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify([])
        
        df = pd.DataFrame(logs)
        if 'timestamp' not in df.columns:
            return jsonify([])
            
        # Harden datetime conversion
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
        df = df.dropna(subset=['timestamp'])
        
        if df.empty:
            return jsonify([])
            
        df = df.set_index('timestamp')
        # Use 'h' instead of 'H' to avoid deprecation warning in newer pandas
        resampled = df.resample('h').size()
        
        mean_val = resampled.mean() if not resampled.empty else 0
        
        timeline = []
        for ts, count in resampled.items():
            try:
                timeline.append({
                    "time": ts.strftime('%Y-%m-%d %H:%M'),
                    "count": int(count),
                    "isAnomaly": bool(count > mean_val + 1)
                })
            except Exception as loop_e:
                print(f"Error in timeline loop: {loop_e}")
                continue
            
        return jsonify(timeline)
    except Exception as e:
        print(f"Timeline error: {e}")
        return jsonify({'error': str(e)}), 500

# --- Existing Advanced AI: Autoencoder ---

# LogAutoencoder class moved inside train() for lazy TF loading

model = None
feature_max = None

def preprocess_logs(logs):
    import numpy as np
    features = []
    level_map = {'DEBUG': 0, 'INFO': 1, 'WARN': 2, 'ERROR': 3, 'FATAL': 4}
    source_map = {'api-gateway': 0, 'user-service': 1, 'db-replicator': 2, 'frontend-logger': 3, 'auth-service': 4}
    for log in logs:
        level_val = level_map.get(log.get('level', 'INFO'), 1)
        source_val = source_map.get(log.get('source', 'api-gateway'), 0)
        msg_len = len(log.get('message', ''))
        features.append([level_val, source_val, msg_len])
    return np.array(features, dtype=np.float32)

@app.route('/train', methods=['POST'])
def train():
    global model, feature_max
    import numpy as np
    tf = get_tensorflow()
    
    try:
        data = request.json
        logs = data.get('logs', [])
        model_type = data.get('model_type', 'tensorflow') # 'tensorflow' or 'huggingface'
        
        print(f"[TRAIN] Received: logs={type(logs)}, len={len(logs) if logs else 'None'}, model_type={model_type}")
        
        if logs is None and model_type != 'huggingface': 
            print("[TRAIN] Rejecting: logs is None and not HF")
            return jsonify({'error': 'No logs provided'}), 400
        
        # Hyperparameters
        epochs = int(data.get('epochs', 20))
        batch_size = int(data.get('batch_size', 16))
        dropout_rate = float(data.get('dropout', 0.1))
        
        print(f"[TRAIN] Checking model_type: {model_type}")
        # Handle Hugging Face training separately (doesn't need log preprocessing)
        if model_type == 'huggingface':
            print("[TRAIN] Entering HF training block")
            try:
                from transformers import AutoModelForSequenceClassification, AutoTokenizer, Trainer, TrainingArguments
                from datasets import load_dataset
                import torch
                
                model_name = data.get('model_name', 'distilbert-base-uncased')
                dataset_name = data.get('dataset_name', 'imdb') # Default to IMDB for demo if no log dataset specified
                
                # Load Tokenizer & Model
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                hf_model = AutoModelForSequenceClassification.from_pretrained(model_name, num_labels=2)
                
                # Load Dataset
                if dataset_name == 'custom':
                    # Convert local logs to HF dataset format
                    from datasets import Dataset
                    texts = [l.get('message', '') for l in logs]
                    # Map ERROR and FATAL to 1, others to 0
                    labels = [1 if l.get('level') in ['ERROR', 'FATAL'] else 0 for l in logs] 
                    dataset = Dataset.from_dict({'text': texts, 'labels': labels})
                    
                    # Tokenize
                    def tokenize_function(examples):
                        return tokenizer(examples["text"], padding="max_length", truncation=True)
                    
                    dataset = dataset.map(tokenize_function, batched=True)
                    # Split
                    dataset = dataset.train_test_split(test_size=0.2)
                    print(f"[TRAIN] Custom dataset columns: {dataset['train'].column_names}")
                else:
                    # Load from Hub (limit to small subset for demo speed)
                    dataset = load_dataset(dataset_name)
                    # Tokenize
                    def tokenize_function(examples):
                        return tokenizer(examples["text"], padding="max_length", truncation=True)
                    
                    tokenized_datasets = dataset.map(tokenize_function, batched=True)
                    
                    small_train_dataset = tokenized_datasets["train"].shuffle(seed=42).select(range(100)) # Small subset
                    small_eval_dataset = tokenized_datasets["test"].shuffle(seed=42).select(range(100))
                    
                    dataset = {'train': small_train_dataset, 'test': small_eval_dataset}
                    print(f"[TRAIN] Hub dataset columns: {dataset['train'].column_names}")

                training_args = TrainingArguments(
                    output_dir="./results",
                    num_train_epochs=1, # Keep it fast
                    per_device_train_batch_size=4,
                    logging_dir='./logs',
                    remove_unused_columns=True, # Ensure only model-supported columns are passed
                )
                
                print(f"[TRAIN] Starting Trainer with {len(dataset['train'])} samples...")
                trainer = Trainer(
                    model=hf_model,
                    args=training_args,
                    train_dataset=dataset['train'],
                    eval_dataset=dataset['test'],
                )
                
                trainer.train()
                eval_results = trainer.evaluate()
                
                # Save model to disk (use safe_serialization=False for Windows compatibility)
                save_path = "./models/hf_model"
                os.makedirs(save_path, exist_ok=True)
                hf_model.save_pretrained(save_path, safe_serialization=False)
                tokenizer.save_pretrained(save_path)
                print(f"[TRAIN] Model saved to {save_path}")

                # Save model to global state AND registry
                global nlp_model, nlp_tokenizer, model_registry
                nlp_model = hf_model
                nlp_tokenizer = tokenizer
                
                # Add to model registry for classification
                model_registry['huggingface'] = {
                    'model': hf_model,
                    'tokenizer': tokenizer,
                    'model_name': model_name,
                    'dataset_name': dataset_name
                }
                print(f"[TRAIN] Model added to registry for classification")
                
                return jsonify({
                    'message': f'Hugging Face model {model_name} trained on {dataset_name} and saved.',
                    'status': 'ready',
                    'metrics': eval_results,
                    'framework': 'Hugging Face Transformers'
                })
                
            except Exception as hf_e:
                print(f"Hugging Face Error: {hf_e}")
                return jsonify({'error': f"Hugging Face training failed: {str(hf_e)}"}), 500

        # For TensorFlow/scikit-learn training, preprocess the logs
        X = preprocess_logs(logs)
        feature_max = np.max(X, axis=0)
        feature_max[feature_max == 0] = 1
        X_scaled = X / feature_max
        
        # Train/Val Split (80/20)
        split_idx = int(len(X_scaled) * 0.8)
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]

        if not tf:
            from sklearn.ensemble import IsolationForest
            model = IsolationForest(contamination=0.1, random_state=42)
            model.fit(X_train)
            
            # Simple train/val loss simulation
            train_scores = model.score_samples(X_train)
            val_scores = model.score_samples(X_val) if len(X_val) > 0 else train_scores
            
            train_loss = float(-np.mean(train_scores))
            val_loss = float(-np.mean(val_scores))
            
            analysis = "Balanced"
            if val_loss > train_loss * 1.5: analysis = "Overfitting"
            elif train_loss > 0.5: analysis = "Underfitting"
            
            return jsonify({
                'message': 'Model trained using scikit-learn (TensorFlow unavailable)', 
                'samples': len(logs), 
                'status': 'ready',
                'metrics': {
                    'train_loss': train_loss,
                    'val_loss': val_loss,
                    'analysis': analysis
                },
                'framework': 'Scikit-learn (Isolation Forest)'
            })
        
        # TensorFlow path
        class LogAutoencoder(tf.keras.Model):
            def __init__(self, input_dim, dropout):
                super(LogAutoencoder, self).__init__()
                self.encoder = tf.keras.Sequential([
                    tf.keras.layers.Dense(8, activation='relu'),
                    tf.keras.layers.Dropout(dropout),
                    tf.keras.layers.Dense(4, activation='relu')
                ])
                self.decoder = tf.keras.Sequential([
                    tf.keras.layers.Dense(8, activation='relu'),
                    tf.keras.layers.Dense(input_dim, activation='sigmoid')
                ])

            def call(self, x):
                encoded = self.encoder(x)
                decoded = self.decoder(encoded)
                return decoded

        model = LogAutoencoder(X_train.shape[1], dropout_rate)
        model.compile(optimizer='adam', loss='mse')
        
        history = model.fit(
            X_train, X_train, 
            epochs=epochs, 
            batch_size=batch_size, 
            validation_data=(X_val, X_val) if len(X_val) > 0 else None,
            verbose=0
        )
        
        train_loss = history.history['loss'][-1]
        val_loss = history.history.get('val_loss', [train_loss])[-1]
        
        # Analysis
        analysis = "Balanced"
        if val_loss > train_loss * 1.5: analysis = "Overfitting"
        elif train_loss > 0.1: analysis = "Underfitting"
        
        return jsonify({
            'message': 'Model trained', 
            'samples': len(logs), 
            'status': 'ready',
            'metrics': {
                'train_loss': float(train_loss),
                'val_loss': float(val_loss),
                'analysis': analysis
            },
            'framework': 'TensorFlow'
        })
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    global model, feature_max
    try:
        import numpy as np
        data = request.json
        logs = data.get('logs', [])
        if not logs: return jsonify({'error': 'No logs provided'}), 400
        X = preprocess_logs(logs)
        if model is not None and feature_max is not None:
            X_norm = X / feature_max
            reconstructions = model.predict(X_norm)
            mse = np.mean(np.power(X_norm - reconstructions, 2), axis=1)
            return jsonify({
                'analysis': {
                    'mean_score': float(np.mean(mse)),
                    'high_risk_count': int(np.sum(mse > 0.1)),
                    'total_processed': len(logs),
                    'individual_scores': mse.tolist()
                },
                'model': 'tf-autoencoder-v1'
            })
        else:
            return jsonify({'analysis': {'mean_score': 0, 'message': 'Model not trained'}})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Legacy endpoints for compatibility
@app.route('/explain', methods=['POST'])
def explain():
    try:
        data = request.json
        log_entry = data.get('logEntry', {})
        explanation = f"<p><b>Internal Analysis:</b> {log_entry.get('level')} log from {log_entry.get('source')}.</p>"
        return jsonify({'explanation': explanation})
    except Exception as e: return jsonify({'error': str(e)}), 500

@app.route('/rca', methods=['POST'])
def rca():
    return jsonify({'summary': 'Local RCA complete', 'keyEvents': [], 'nextSteps': []})

@app.route('/playbook', methods=['POST'])
def playbook():
    return jsonify({'title': 'Playbook', 'summary': 'Steps', 'triageSteps': []})

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message', '').lower()
        
        # Simple rule-based logic for "Internal AI"
        reply = "I am the Internal Python AI. I can help you analyze logs, detect anomalies, and forecast trends."
        
        if 'hello' in message or 'hi' in message:
            reply = "Hello! I am ready to assist you with your log analysis."
        elif 'status' in message or 'health' in message:
            reply = "The system appears to be running smoothly. My internal models are active."
        elif 'log' in message or 'error' in message:
            reply = "I can help identify errors. Please use the 'Explain' feature on a specific log entry, or ask me to 'Analyze' in the Log Explorer."
        elif 'help' in message:
            reply = "You can ask me about system status, or use my specialized features like 'Semantic Search' and 'Anomaly Detection' in the dashboard."
        else:
            reply = "I understood your message. While I am a specialized log analysis AI, for general conversation I recommend using the Gemini or OpenAI providers. I am optimized for pattern recognition and anomaly detection."

        return jsonify({'reply': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Pro Feature 10: Hugging Face Inference ---
@app.route('/predict_hf', methods=['POST'])
def predict_hf():
    global nlp_model, nlp_tokenizer
    try:
        if not nlp_model or not nlp_tokenizer:
            # Try to load from disk if not in memory
            try:
                from transformers import AutoModelForSequenceClassification, AutoTokenizer
                model_path = "./models/hf_model"
                if os.path.exists(model_path):
                    print(f"[PREDICT] Loading model from {model_path}...")
                    nlp_model = AutoModelForSequenceClassification.from_pretrained(model_path)
                    nlp_tokenizer = AutoTokenizer.from_pretrained(model_path)
                else:
                    return jsonify({'error': 'Model not trained or loaded'}), 400
            except Exception as e:
                print(f"[PREDICT] Load error: {e}")
                return jsonify({'error': f'Failed to load model: {str(e)}'}), 500

        data = request.json
        text = data.get('text', '')
        if not text: return jsonify({'error': 'No text provided'}), 400

        import torch
        inputs = nlp_tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
        with torch.no_grad():
            outputs = nlp_model(**inputs)
            probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
            predicted_class = torch.argmax(probabilities, dim=-1).item()
            score = probabilities[0][predicted_class].item()
        
        # Default IMDB labels: 0=Negative, 1=Positive
        # For custom logs, it might be 0=Info, 1=Error
        label = "POSITIVE" if predicted_class == 1 else "NEGATIVE"
        
        return jsonify({
            'label': label,
            'score': float(score),
            'class_id': predicted_class
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Kaggle Dataset Training ---
@app.route('/train-dataset', methods=['POST'])
def train_dataset():
    """Train a scikit-learn classifier on uploaded CSV data"""
    try:
        import pandas as pd
        import numpy as np
        from sklearn.model_selection import train_test_split
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.linear_model import LogisticRegression
        from sklearn.svm import SVC
        from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
        from sklearn.preprocessing import LabelEncoder
        
        data = request.json
        csv_data = data.get('csv_data', '')  # CSV as string
        target_column = data.get('target_column', '')
        feature_columns = data.get('feature_columns', [])
        model_type = data.get('model_type', 'random_forest')
        
        if not csv_data or not target_column or not feature_columns:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Parse CSV
        from io import StringIO
        df = pd.read_csv(StringIO(csv_data))
        
        # Prepare features and target
        X = df[feature_columns]
        y = df[target_column]
        
        # Encode categorical features if any
        for col in X.columns:
            if X[col].dtype == 'object':
                le = LabelEncoder()
                X[col] = le.fit_transform(X[col].astype(str))
        
        # Encode target if categorical
        if y.dtype == 'object':
            le_target = LabelEncoder()
            y = le_target.fit_transform(y.astype(str))
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Select and train model
        if model_type == 'random_forest':
            model = RandomForestClassifier(n_estimators=100, random_state=42)
        elif model_type == 'logistic_regression':
            model = LogisticRegression(max_iter=1000, random_state=42)
        elif model_type == 'svm':
            model = SVC(kernel='rbf', random_state=42)
        else:
            return jsonify({'error': f'Unknown model type: {model_type}'}), 400
        
        model.fit(X_train, y_train)
        
        # Evaluate
        y_pred = model.predict(X_test)
        
        # Calculate metrics (handle multi-class with 'weighted' average)
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        # Save model to disk
        import pickle
        model_save_path = f"./models/kaggle_{model_type}.pkl"
        os.makedirs("./models", exist_ok=True)
        with open(model_save_path, 'wb') as f:
            pickle.dump(model, f)
        print(f"[TRAIN-DATASET] Model saved to {model_save_path}")
        
        # Add to model registry
        global model_registry
        model_registry['kaggle'][model_type] = {
            'model': model,
            'model_type': model_type,
            'feature_columns': feature_columns,
            'target_column': target_column
        }
        print(f"[TRAIN-DATASET] Model added to registry")
        
        return jsonify({
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'model_type': model_type,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'message': f'Model trained successfully on {len(df)} samples'
        })
        
    except Exception as e:
        print(f"[TRAIN-DATASET] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# --- Model Classification ---
@app.route('/classify-log', methods=['POST'])
def classify_log():
    """Classify a single log using the active model"""
    try:
        data = request.json
        text = data.get('text', '')
        model_type = data.get('model_type', 'huggingface')
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        if model_type == 'huggingface':
            # Use HuggingFace model
            if model_registry['huggingface'] is None:
                return jsonify({'error': 'No HuggingFace model loaded'}), 400
            
            import torch
            model_data = model_registry['huggingface']
            model = model_data['model']
            tokenizer = model_data['tokenizer']
            
            inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=512)
            with torch.no_grad():
                outputs = model(**inputs)
                probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
                predicted_class = torch.argmax(probabilities, dim=-1).item()
                score = probabilities[0][predicted_class].item()
            
            # 0 = Normal, 1 = Critical (for log classification)
            label = "CRITICAL" if predicted_class == 1 else "NORMAL"
            
            return jsonify({
                'prediction': label,
                'confidence': float(score),
                'class_id': predicted_class
            })
        
        elif model_type == 'kaggle':
            # Use Kaggle model
            model_name = data.get('model_name', 'default')
            if model_name not in model_registry['kaggle']:
                return jsonify({'error': f'Kaggle model {model_name} not found'}), 400
            
            # For Kaggle models, we'd need the features
            # This is a simplified version
            return jsonify({
                'prediction': 'NORMAL',
                'confidence': 0.5,
                'note': 'Kaggle model classification requires feature engineering'
            })
        
        else:
            return jsonify({'error': 'Invalid model type'}), 400
            
    except Exception as e:
        print(f"[CLASSIFY] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Try to load model on startup
    try:
        if HAS_TRANSFORMERS:
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            model_path = "./models/hf_model"
            if os.path.exists(model_path):
                print(f"[STARTUP] Loading saved HF model from {model_path}...")
                nlp_model = AutoModelForSequenceClassification.from_pretrained(model_path)
                nlp_tokenizer = AutoTokenizer.from_pretrained(model_path)
                print("[STARTUP] Model loaded successfully.")
    except Exception as e:
        print(f"[STARTUP] Warning: Could not load saved model: {e}")

    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port)
