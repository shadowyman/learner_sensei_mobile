import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CodeEditorBadge } from './CodeEditorBadge';
import { SendIconSkia } from './SendIconSkia';
import { logger } from '../../logger';

const INPUT_LINE_HEIGHT = 20;

interface InputBarProps {
  onSubmit?: (text: string) => void;
  onOpenEditor?: () => void;
  onLayoutRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
  onInputFieldRect?: (rect: { x: number; y: number; width: number; height: number } | null) => void;
}

	export const InputBar: React.FC<InputBarProps> = ({ onSubmit, onOpenEditor, onLayoutRect, onInputFieldRect }) => {
		const [text, setText] = useState('');
	const inputRef = useRef<TextInput | null>(null);
	const wrapperRef = useRef<View | null>(null);
	const inputContainerRef = useRef<View | null>(null);
	const fieldFrameRef = useRef<View | null>(null);

		const minHeight = 44;

		const handleSubmit = useCallback(() => {
			const trimmed = text.trim();
			if (!trimmed) return;
			try {
				onSubmit?.(trimmed);
			} finally {
				setText('');
			}
		}, [onSubmit, text]);

  const measureRect = useCallback(() => {
    const node: any = wrapperRef.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (!w || !h) return;
      logger.info('Sensei(debug)', { tag: 'inputBar.rect', x, y, w, h });
      onLayoutRect?.({ x, y, width: w, height: h });
    });
  }, [onLayoutRect]);

	const measureInputRect = useCallback(() => {
		const node: any = fieldFrameRef.current;
		if (!node || typeof node.measureInWindow !== 'function') return;
		node.measureInWindow((x: number, y: number, w: number, h: number) => {
			if (!w || !h) return;
			logger.info('Sensei(debug)', { tag: 'inputField.rect', x, y, w, h });
			onInputFieldRect?.({ x, y, width: w, height: h });
		});
	}, [onInputFieldRect]);

		const scheduleMeasureInputRect = useCallback(() => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				measureInputRect();
			});
		});
	}, [measureInputRect]);

	const editorSize = 26;

  return (
    <View
      ref={wrapperRef}
      style={styles.wrapper}
      onLayout={measureRect}
    >
	      <View ref={inputContainerRef} style={styles.inputContainer}>
	        <View ref={fieldFrameRef} onLayout={scheduleMeasureInputRect}>
	        <TextInput
	          ref={inputRef}
	          value={text}
	          onChangeText={setText}
	          placeholder="Ask Sensei a question or type your thoughts..."
	          multiline={false}
	          style={styles.textInput}
		          placeholderTextColor={'rgba(148,163,184,0.65)'}
		          selectionColor={'#22d3ee'}
		          returnKeyType={'default'}
		          blurOnSubmit={false}
		        />
		        </View>
		      </View>
	      <View style={styles.actions}>
	        <View style={styles.sendStack}>
	          <TouchableOpacity
	            accessibilityRole="button"
	            accessibilityLabel="Send message"
	            onPress={handleSubmit}
	            style={styles.sendButton}
	          >
	            <SendIconSkia size={14} />
	          </TouchableOpacity>
	          <View style={[styles.editorOverlay, { top: -6, right: -17 }]}> 
            <CodeEditorBadge size={editorSize} onPress={onOpenEditor} />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
	wrapper: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 10,
		paddingVertical: 0,
		marginBottom: 10,
		width: '98%',
		alignSelf: 'center',
		backgroundColor: 'transparent',
    gap: 10
  },
	inputContainer: {
		flex: 1,
		maxWidth: '100%',
		marginLeft: 0,
		marginRight: 0
	},
	textInput: {
		width: '100%',
		minHeight: 44,
		maxHeight: 120,
		paddingHorizontal: 16,
		paddingVertical: 10,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    color: '#e2e8f0',
    fontSize: 16,
    lineHeight: INPUT_LINE_HEIGHT
	},
	actions: {
		flexDirection: 'row',
		alignItems: 'center',
		flexShrink: 0,
		marginRight: 20
	},
	sendStack: {
		position: 'relative',
		paddingRight: 16,
		alignItems: 'center',
		justifyContent: 'center'
	},
	sendButton: {
		width: 35,
		height: 35,
		borderRadius: 17.5,
		backgroundColor: '#10b981',
		borderWidth: 1,
		borderColor: 'rgba(16,185,129,0.4)',
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#10b981',
		shadowOpacity: 0.3,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 }
	},
  sendButtonText: {
    color: '#050505',
    fontWeight: '600'
  },
  editorOverlay: {
    position: 'absolute'
  }
});

export default InputBar;
