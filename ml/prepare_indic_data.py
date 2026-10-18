"""
Sentinel AI — Multilingual & Indic Dataset Ingestion & Validation Pipeline
Validates raw datasets in data/raw/indic/ and applies consistent multi-label harmonization.
Preserves original labels and tracks unknown categories transparently.
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

RAW_INDIC_DIR = "data/raw/indic"
PROCESSED_INDIC_DIR = "data/processed/indic"

class IndicDatasetProcessor:
    """
    Standardizes raw Indian-language datasets into Sentinel AI harmonized format:
    Columns: [text, language, is_code_mixed, hate_speech, harassment, cyberbullying, legitimate, source_dataset, split]
    Values: 1.0 (positive), 0.0 (negative), None/np.nan (unannotated/unknown)
    """

    def __init__(self, raw_dir: str = RAW_INDIC_DIR, out_dir: str = PROCESSED_INDIC_DIR):
        self.raw_dir = raw_dir
        self.out_dir = out_dir
        os.makedirs(self.out_dir, exist_ok=True)

    def process_telugu(self) -> Dict[str, pd.DataFrame]:
        """Process IIIT Hyderabad Telugu Hatespeech dataset."""
        splits = {}
        for split_name, fname in [('train', 'telugu_train.csv'), ('val', 'telugu_val.csv'), ('test', 'telugu_test.csv')]:
            fpath = os.path.join(self.raw_dir, fname)
            if not os.path.exists(fpath):
                continue
            df = pd.read_csv(fpath)
            
            clean_df = pd.DataFrame()
            clean_df['text'] = df['Sentence'].astype(str).str.strip()
            clean_df['language'] = 'telugu'
            clean_df['is_code_mixed'] = False
            clean_df['source_dataset'] = 'mounikaiiith/Telugu-Hatespeech'
            clean_df['split'] = split_name
            
            # Label mapping: 'yes' -> hate_speech=1.0, legitimate=0.0; 'no' -> hate_speech=0.0, legitimate=1.0
            # harassment & cyberbullying are UNANNOTATED (NaN)
            is_hate = (df['Hate-Speech'].astype(str).str.lower().str.strip() == 'yes').astype(float)
            clean_df['hate_speech'] = is_hate
            clean_df['harassment'] = np.nan
            clean_df['cyberbullying'] = np.nan
            clean_df['legitimate'] = 1.0 - is_hate
            
            splits[split_name] = clean_df
            clean_df.to_csv(os.path.join(self.out_dir, f'telugu_{split_name}.csv'), index=False)
        return splits

    def process_kannada(self) -> Dict[str, pd.DataFrame]:
        """Process OffenseVal Dravidian Kannada dataset."""
        splits = {}
        # OffenseVal mapping:
        # 0: Not_offensive -> leg=1, hate=0, har=0, cyb=0
        # 1: Offensive_Untargetede -> leg=0, har=0.5, cyb=0, hate=NaN
        # 2: Offensive_Targeted_Insult_Individual -> leg=0, har=1.0, cyb=1.0, hate=NaN
        # 3: Offensive_Targeted_Insult_Group -> leg=0, hate=1.0, har=0.5, cyb=NaN
        # 4: Offensive_Targeted_Insult_Other -> leg=0, har=0.5, hate=NaN, cyb=NaN
        # 5: not-Kannada -> excluded or flagged
        for split_name, fname in [('train', 'kannada_train.parquet'), ('val', 'kannada_val.parquet')]:
            fpath = os.path.join(self.raw_dir, fname)
            if not os.path.exists(fpath):
                continue
            df = pd.read_parquet(fpath)
            
            # Filter out non-Kannada noise if label == 5
            valid_mask = df['label'] != 5
            df = df[valid_mask].copy()
            
            clean_df = pd.DataFrame()
            clean_df['text'] = df['text'].astype(str).str.strip()
            clean_df['language'] = 'kannada'
            clean_df['is_code_mixed'] = clean_df['text'].str.contains(r'^[a-zA-Z0-9\s\.\,\!\?]+$', regex=True)
            clean_df['source_dataset'] = 'community-datasets/offenseval_dravidian'
            clean_df['split'] = split_name
            
            clean_df['hate_speech'] = np.where(df['label'] == 3, 1.0, np.where(df['label'] == 0, 0.0, np.nan))
            clean_df['harassment'] = np.where(df['label'].isin([1, 4]), 0.5, np.where(df['label'] == 2, 1.0, np.where(df['label'] == 0, 0.0, np.nan)))
            clean_df['cyberbullying'] = np.where(df['label'] == 2, 1.0, np.where(df['label'] == 0, 0.0, np.nan))
            clean_df['legitimate'] = np.where(df['label'] == 0, 1.0, 0.0)
            
            splits[split_name] = clean_df
            clean_df.to_csv(os.path.join(self.out_dir, f'kannada_{split_name}.csv'), index=False)
        return splits

    def process_hinglish(self) -> Dict[str, pd.DataFrame]:
        """Process PRISM Hinglish code-mixed dataset."""
        splits = {}
        for split_name, fname in [('train', 'hinglish_train.csv'), ('val', 'hinglish_val.csv'), ('test', 'hinglish_test.csv')]:
            fpath = os.path.join(self.raw_dir, fname)
            if not os.path.exists(fpath):
                continue
            df = pd.read_csv(fpath)
            
            clean_df = pd.DataFrame()
            clean_df['text'] = df['text'].astype(str).str.strip()
            clean_df['language'] = df['lang'].astype(str).str.lower()
            clean_df['is_code_mixed'] = clean_df['language'].isin(['hinglish'])
            clean_df['source_dataset'] = 'pankajbiswas6/prism-hinglish-hate-speech'
            clean_df['split'] = split_name
            
            is_hate = (df['label'] == 1).astype(float)
            clean_df['hate_speech'] = is_hate
            clean_df['harassment'] = np.nan
            clean_df['cyberbullying'] = np.nan
            clean_df['legitimate'] = 1.0 - is_hate
            
            splits[split_name] = clean_df
            clean_df.to_csv(os.path.join(self.out_dir, f'hinglish_{split_name}.csv'), index=False)
        return splits

    def process_hindi_hostility(self) -> pd.DataFrame:
        """Process Hindi Social Media Hostility dataset."""
        fpath = os.path.join(self.raw_dir, 'hindi_hostility_train.parquet')
        if not os.path.exists(fpath):
            return pd.DataFrame()
        df = pd.read_parquet(fpath)
        
        clean_df = pd.DataFrame()
        clean_df['text'] = df['Post'].astype(str).str.strip()
        clean_df['language'] = 'hindi'
        clean_df['is_code_mixed'] = False
        clean_df['source_dataset'] = 'necrosyth/hindi-social-media-hostility-detection'
        clean_df['split'] = 'train'
        
        labels_str = df['Labels Set'].astype(str).str.lower()
        clean_df['hate_speech'] = labels_str.apply(lambda s: 1.0 if 'hate' in s else (0.0 if 'non-hostile' in s else np.nan))
        clean_df['harassment'] = labels_str.apply(lambda s: 1.0 if 'offensive' in s else (0.0 if 'non-hostile' in s else np.nan))
        clean_df['cyberbullying'] = labels_str.apply(lambda s: 1.0 if 'defamation' in s else (0.0 if 'non-hostile' in s else np.nan))
        clean_df['legitimate'] = labels_str.apply(lambda s: 1.0 if 'non-hostile' in s else 0.0)
        
        clean_df.to_csv(os.path.join(self.out_dir, 'hindi_hostility_train.csv'), index=False)
        return clean_df

    def run_all(self) -> Dict[str, Any]:
        """Run standard ingestion and return summary statistics."""
        t_splits = self.process_telugu()
        k_splits = self.process_kannada()
        h_splits = self.process_hinglish()
        hindi_df = self.process_hindi_hostility()
        
        summary = {
            'telugu_processed_splits': {k: len(v) for k, v in t_splits.items()},
            'kannada_processed_splits': {k: len(v) for k, v in k_splits.items()},
            'hinglish_processed_splits': {k: len(v) for k, v in h_splits.items()},
            'hindi_hostility_train_rows': len(hindi_df)
        }
        with open(os.path.join(self.out_dir, 'indic_processing_summary.json'), 'w') as f:
            json.dump(summary, f, indent=2)
        return summary

if __name__ == '__main__':
    processor = IndicDatasetProcessor()
    stats = processor.run_all()
    print("Indic Dataset Harmonization Completed:")
    print(json.dumps(stats, indent=2))
