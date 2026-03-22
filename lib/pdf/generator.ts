import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import type { Debate } from '@/types';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#0a0a08',
    padding: 40,
    fontFamily: 'Helvetica',
    color: '#f5f5f3',
  },
  coverTitle: {
    fontSize: 28,
    marginTop: 120,
    color: '#f5f5f3',
  },
  coverAccent: {
    color: '#e8ff47',
    fontSize: 28,
    marginTop: 8,
  },
  coverSub: {
    fontSize: 12,
    color: '#888885',
    marginTop: 24,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 40,
    fontSize: 10,
    color: '#888885',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#e8ff47',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2a',
    paddingBottom: 6,
  },
  question: {
    fontSize: 14,
    color: '#f5f5f3',
    marginBottom: 16,
    lineHeight: 1.5,
  },
  card: {
    backgroundColor: '#1a1a18',
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 10,
    borderRadius: 4,
  },
  cardTitle: {
    fontSize: 10,
    color: '#888885',
    marginBottom: 4,
  },
  cardContent: {
    fontSize: 10,
    color: '#f5f5f3',
    lineHeight: 1.4,
  },
  synthesisBox: {
    backgroundColor: 'rgba(232, 255, 71, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 71, 0.3)',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  synthesisText: {
    fontSize: 11,
    color: '#f5f5f3',
    lineHeight: 1.5,
  },
});

function DecisionBriefDoc({ debate }: { debate: Debate }) {
  const validResponses = debate.ai_responses.filter((r) => !r.error && r.content);

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.coverTitle }, 'Decision Brief'),
      React.createElement(Text, { style: styles.coverAccent }, 'Manyminds'),
      React.createElement(
        Text,
        { style: styles.coverSub },
        'Collective intelligence — ',
        new Date(debate.created_at).toLocaleDateString('en-US')
      ),
      React.createElement(Text, { style: styles.pageNumber }, '1')
    ),
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, 'QUESTION'),
      React.createElement(Text, { style: styles.question }, debate.question),
      React.createElement(Text, { style: styles.sectionTitle }, 'AI RESPONSES'),
      ...validResponses.map((r) =>
        React.createElement(
          View,
          {
            key: r.model,
            style: [styles.card, { borderLeftColor: '#e8ff47' }],
          },
          React.createElement(Text, { style: styles.cardTitle }, r.displayName),
          React.createElement(Text, { style: styles.cardContent }, r.content)
        )
      ),
      React.createElement(Text, { style: styles.pageNumber }, '2')
    ),
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, 'ANALYSIS'),
      React.createElement(
        Text,
        { style: styles.question },
        'Consensus score: ',
        debate.consensus_score,
        '% — ',
        debate.has_disagreement ? 'Significant disagreement' : 'General agreement'
      ),
      ...debate.disagreement_details.map((d, i) =>
        React.createElement(
          View,
          { key: i, style: styles.card },
          React.createElement(Text, { style: styles.cardTitle }, d.topic),
          React.createElement(Text, { style: styles.cardContent }, d.description)
        )
      ),
      React.createElement(Text, { style: styles.pageNumber }, '3')
    ),
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.sectionTitle }, 'MANYMINDS ANSWER'),
      React.createElement(
        View,
        { style: styles.synthesisBox },
        React.createElement(Text, { style: styles.synthesisText }, debate.synthesis)
      ),
      React.createElement(Text, { style: styles.pageNumber }, '4')
    )
  );
}

export async function generateDecisionBrief(debate: Debate): Promise<Uint8Array> {
  const blob = await pdf(
    React.createElement(DecisionBriefDoc, { debate }) as React.ReactElement
  ).toBlob();
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}
