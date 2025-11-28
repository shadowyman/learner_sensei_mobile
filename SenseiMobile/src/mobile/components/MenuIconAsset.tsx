import React from 'react';
import FontSizeIcon from '../../assets/icons/font-size.svg';
import ThemePaletteIcon from '../../assets/icons/theme-palette.svg';
import NotepadClipIcon from '../../assets/icons/notepad-clip.svg';
import SaveFloppyIcon from '../../assets/icons/save-floppy.svg';
import LoadFolderIcon from '../../assets/icons/load-folder.svg';
import TelemetrySignalIcon from '../../assets/icons/telemetry-signal.svg';

interface MenuIconAssetProps {
    name: 'font' | 'theme' | 'note' | 'save' | 'load' | 'telemetry';
    size?: number;
    color?: string;
}

export const MenuIconAsset: React.FC<MenuIconAssetProps> = ({ name, size = 27 }) => {
    if (name === 'font') {
        return <FontSizeIcon width={size} height={size} />;
    }
    if (name === 'theme') {
        return <ThemePaletteIcon width={size} height={size} />;
    }
    if (name === 'note') {
        return <NotepadClipIcon width={size} height={size} />;
    }
    if (name === 'save') {
        return <SaveFloppyIcon width={size} height={size} />;
    }
    if (name === 'load') {
        return <LoadFolderIcon width={size} height={size} />;
    }
    if (name === 'telemetry') {
        return <TelemetrySignalIcon width={size} height={size} />;
    }
    return null;
};

export default MenuIconAsset;
