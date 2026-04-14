import { describe, expect, it } from 'vitest';
import { dedupeConsecutiveDuplicateAssistants } from '@/stores/chat/helpers';
import type { RawMessage } from '@/stores/chat/types';

describe('dedupeConsecutiveDuplicateAssistants', () => {
  it('merges two consecutive identical long assistant strings', () => {
    const text = 'a'.repeat(30);
    const messages: RawMessage[] = [
      { role: 'user', content: 'hi' } as RawMessage,
      { role: 'assistant', content: text } as RawMessage,
      { role: 'assistant', content: text } as RawMessage,
    ];
    const out = dedupeConsecutiveDuplicateAssistants(messages);
    expect(out).toHaveLength(2);
    expect(out[1].role).toBe('assistant');
    expect(out[1].content).toBe(text);
  });

  it('keeps consecutive short identical assistant replies', () => {
    const messages: RawMessage[] = [
      { role: 'assistant', content: '好' } as RawMessage,
      { role: 'assistant', content: '好' } as RawMessage,
    ];
    expect(dedupeConsecutiveDuplicateAssistants(messages)).toHaveLength(2);
  });

  it('does not merge assistant separated by user', () => {
    const text = 'b'.repeat(30);
    const messages: RawMessage[] = [
      { role: 'assistant', content: text } as RawMessage,
      { role: 'user', content: 'ok' } as RawMessage,
      { role: 'assistant', content: text } as RawMessage,
    ];
    expect(dedupeConsecutiveDuplicateAssistants(messages)).toHaveLength(3);
  });
});
