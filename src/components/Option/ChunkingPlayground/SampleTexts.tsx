import React from "react"
import { useTranslation } from "react-i18next"
import { Card, Typography } from "antd"
import {
  FileTextOutlined,
  CodeOutlined,
  AudioOutlined,
  BookOutlined
} from "@ant-design/icons"

const { Text } = Typography

interface SampleTextsProps {
  onSelect: (text: string) => void
}

const SAMPLE_TEXTS = {
  article: {
    icon: <FileTextOutlined />,
    labelKey: "article",
    descriptionKey: "articleDesc",
    text: `# The Future of Artificial Intelligence

Artificial intelligence has rapidly evolved from a niche academic discipline to a transformative force reshaping industries worldwide. In the past decade alone, we have witnessed remarkable breakthroughs in natural language processing, computer vision, and machine learning that were once thought to be decades away.

## Current State of AI

Today's AI systems can engage in nuanced conversations, generate creative content, analyze complex datasets, and even assist in scientific research. Companies across sectors are integrating AI into their operations, from healthcare diagnostics to financial forecasting.

### Key Developments

The development of transformer architectures has been particularly impactful. These models, which power systems like GPT and BERT, have demonstrated an unprecedented ability to understand and generate human language. Their success has sparked a wave of research into larger and more capable models.

### Challenges Ahead

Despite these advances, significant challenges remain. AI systems still struggle with common-sense reasoning, can exhibit biased behavior based on their training data, and often lack the ability to explain their decisions in human-understandable terms.

## Looking Forward

The next frontier in AI research includes developing more efficient training methods, creating systems that can learn from fewer examples, and building AI that can collaborate more effectively with humans. As these technologies mature, they promise to unlock new possibilities across medicine, education, and beyond.

The responsible development of AI will require collaboration between technologists, policymakers, and society at large to ensure these powerful tools benefit humanity as a whole.`
  },
  code: {
    icon: <CodeOutlined />,
    labelKey: "code",
    descriptionKey: "codeDesc",
    text: `"""
Text Chunking Module
Provides utilities for splitting text into manageable chunks.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re


@dataclass
class ChunkMetadata:
    """Metadata for a text chunk."""
    index: int
    start_char: int
    end_char: int
    word_count: int
    overlap_with_previous: int = 0


class TextChunker:
    """Splits text into overlapping chunks based on configurable parameters."""

    def __init__(
        self,
        max_size: int = 500,
        overlap: int = 100,
        method: str = "words"
    ):
        self.max_size = max_size
        self.overlap = overlap
        self.method = method

    def chunk(self, text: str) -> List[Dict[str, Any]]:
        """
        Split text into chunks with metadata.

        Args:
            text: The input text to chunk

        Returns:
            List of dictionaries containing chunk text and metadata
        """
        if not text or not text.strip():
            return []

        words = text.split()
        chunks = []
        start_idx = 0

        while start_idx < len(words):
            end_idx = min(start_idx + self.max_size, len(words))
            chunk_words = words[start_idx:end_idx]
            chunk_text = " ".join(chunk_words)

            metadata = ChunkMetadata(
                index=len(chunks),
                start_char=self._get_char_position(text, start_idx),
                end_char=self._get_char_position(text, end_idx),
                word_count=len(chunk_words),
                overlap_with_previous=min(self.overlap, start_idx)
            )

            chunks.append({
                "text": chunk_text,
                "metadata": metadata
            })

            start_idx += self.max_size - self.overlap

        return chunks

    def _get_char_position(self, text: str, word_idx: int) -> int:
        """Calculate character position for a given word index."""
        words = text.split()
        if word_idx >= len(words):
            return len(text)
        return text.index(words[word_idx])


def create_chunker(**kwargs) -> TextChunker:
    """Factory function to create a configured chunker."""
    return TextChunker(**kwargs)


if __name__ == "__main__":
    sample_text = "This is a sample text for testing the chunker."
    chunker = create_chunker(max_size=5, overlap=2)
    chunks = chunker.chunk(sample_text)
    for chunk in chunks:
        print(f"Chunk {chunk['metadata'].index}: {chunk['text']}")`
  },
  transcript: {
    icon: <AudioOutlined />,
    labelKey: "transcript",
    descriptionKey: "transcriptDesc",
    text: `[00:00:00] Host: Welcome back to the Tech Insights podcast. Today we're discussing the latest developments in AI and machine learning. I'm joined by Dr. Sarah Chen, a researcher at the Institute for Advanced Computing.

[00:00:15] Dr. Chen: Thanks for having me! I'm excited to share some insights about where the field is heading.

[00:00:22] Host: Let's start with the basics. What would you say is the most significant advancement in AI over the past year?

[00:00:30] Dr. Chen: That's a great question. I'd say the emergence of multimodal models has been game-changing. We're now seeing systems that can understand text, images, audio, and video together, which opens up entirely new possibilities.

[00:00:48] Host: Can you give us an example of how these multimodal capabilities are being used in practice?

[00:00:55] Dr. Chen: Certainly. In healthcare, we're seeing systems that can analyze medical images, patient histories, and doctor's notes simultaneously to provide more accurate diagnoses. In creative fields, artists are using these tools to generate content that seamlessly blends different media types.

[00:01:15] Host: That's fascinating. What about the concerns around AI safety that we keep hearing about?

[00:01:22] Dr. Chen: It's an important topic. As these systems become more powerful, we need robust frameworks for testing their behavior, ensuring they don't produce harmful outputs, and making sure they remain aligned with human values.

[00:01:40] Host: What advice would you give to developers who are just starting to work with AI?

[00:01:47] Dr. Chen: Start with the fundamentals. Understand the underlying mathematics and statistics. And always consider the ethical implications of what you're building. The technology is only as good as the intentions behind its use.

[00:02:05] Host: Wise words. Thank you so much for joining us today, Dr. Chen.

[00:02:10] Dr. Chen: My pleasure. Thanks for the thoughtful conversation.`
  },
  academic: {
    icon: <BookOutlined />,
    labelKey: "academic",
    descriptionKey: "academicDesc",
    text: `Abstract

This paper presents a comprehensive analysis of neural network optimization techniques with a focus on gradient-based methods. We examine the theoretical foundations of stochastic gradient descent (SGD) and its variants, including Adam, AdaGrad, and RMSprop. Our experimental results demonstrate that adaptive learning rate methods significantly outperform vanilla SGD on complex optimization landscapes.

1. Introduction

The optimization of neural networks remains a central challenge in machine learning research (Goodfellow et al., 2016). As models grow in size and complexity, efficient training methods become increasingly important. This paper contributes to the literature by providing a unified framework for understanding gradient-based optimization.

2. Background

2.1 Stochastic Gradient Descent

SGD updates parameters using noisy gradient estimates computed from mini-batches:

θ_{t+1} = θ_t - η∇L(θ_t; x_i, y_i)

where η is the learning rate and (x_i, y_i) represents a training sample (Robbins & Monro, 1951).

2.2 Adaptive Methods

Adam (Kingma & Ba, 2015) combines momentum with adaptive learning rates:

m_t = β_1 m_{t-1} + (1 - β_1)g_t
v_t = β_2 v_{t-1} + (1 - β_2)g_t^2

3. Experimental Setup

We evaluated each optimizer on three benchmark datasets: MNIST (LeCun et al., 1998), CIFAR-10 (Krizhevsky, 2009), and ImageNet (Deng et al., 2009). All experiments were conducted using PyTorch with consistent hyperparameter tuning protocols.

4. Results

Our findings indicate that Adam achieves faster convergence in the early training phase, while SGD with momentum often achieves better final performance given sufficient training time. These results align with previous observations (Wilson et al., 2017).

5. Conclusion

We have presented a systematic comparison of neural network optimizers. Future work should explore the relationship between optimizer choice and model architecture, as well as the development of hybrid methods that combine the strengths of different approaches.

References

Goodfellow, I., Bengio, Y., & Courville, A. (2016). Deep Learning. MIT Press.
Kingma, D. P., & Ba, J. (2015). Adam: A method for stochastic optimization. ICLR.
Krizhevsky, A. (2009). Learning multiple layers of features from tiny images. Technical Report.`
  }
}

export const SampleTexts: React.FC<SampleTextsProps> = ({ onSelect }) => {
  const { t } = useTranslation(["settings"])

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(SAMPLE_TEXTS).map(([key, sample]) => (
        <Card
          key={key}
          size="small"
          hoverable
          onClick={() => onSelect(sample.text)}
          className="cursor-pointer transition-all hover:shadow-md">
          <div className="flex items-start gap-3">
            <div className="text-2xl text-primary">{sample.icon}</div>
            <div>
              <div className="font-medium">
                {t(`settings:chunkingPlayground.samples.${sample.labelKey}`, key)}
              </div>
              <Text type="secondary" className="text-xs">
                {t(
                  `settings:chunkingPlayground.samples.${sample.descriptionKey}`,
                  `Sample ${key} text`
                )}
              </Text>
              <div className="text-xs text-text-subtle mt-1">
                {sample.text.length} chars
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
