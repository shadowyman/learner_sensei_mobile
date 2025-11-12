declare module 'react-native' {
    import * as React from 'react';

    export const SafeAreaView: React.ComponentType<any>;
    export const View: React.ComponentType<any>;
    export const Text: React.ComponentType<any>;
    export const TextInput: React.ComponentType<any>;
    export const TouchableOpacity: React.ComponentType<any>;
    export const StyleSheet: {
        create<T extends Record<string, any>>(styles: T): T;
    };
    export const Platform: { OS: 'ios' | 'android' | string };

    export interface NativeSyntheticEvent<T> {
        nativeEvent: T;
    }

    export interface TextInputProps {
        value?: string;
        placeholder?: string;
        multiline?: boolean;
        editable?: boolean;
        onChangeText?: (text: string) => void;
        onSubmitEditing?: () => void;
        style?: any;
    }
}
