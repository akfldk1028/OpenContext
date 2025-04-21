import {extendTheme, type ThemeConfig} from "@chakra-ui/react";

const config: ThemeConfig = {
    initialColorMode: "dark",
    useSystemColorMode: false,
};

const theme = extendTheme({
    config,
    colors: {
        customBg: {
            light: "#F8F8F8",
            dark: "#1e1e1e",
        },
        customText: {
            light: "#333333",
            dark: "#e0e0e0",
        },
        customBorder: {
            light: "rgba(255, 255, 255, 0.45)",
            dark: "rgba(255, 255, 255, 0.16)",  // 연한 흰색으로 변경, 투명도 16%
        },
        customCard: {
            light: "#f7fafc",
            dark: "#2a2a2a",
        },
        customAccent: {
            light: "#ff69b4", // 밝은 핑크색 (Hot Pink)
            dark: "#ff1493", // 더 진한 핑크색 (Deep Pink)
        },
        customFolder: {
            light: "#ff69b4", // 밝은 핑크색 (Hot Pink)
            dark: "#ff1493", // 더 진한 핑크색 (Deep Pink)
        },
    },
    styles: {
        global: (props: any) => ({
            body: {
                bg: props.colorMode === "dark" ? "customBg.dark" : "customBg.light",
                color: props.colorMode === "dark" ? "customText.dark" : "customText.light",
            },
        }),
    },
});

export default theme;
