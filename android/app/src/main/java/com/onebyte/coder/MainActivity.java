package com.onebyte.coder;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Set initial scale for web view
        getBridge().getWebView().getSettings().setLoadWithOverviewMode(true);
        getBridge().getWebView().getSettings().setUseWideViewPort(true);
    }

    @Override
    public ArrayList<Class<? extends Plugin>> getPlugins() {
        ArrayList<Class<? extends Plugin>> plugins = new ArrayList<>();
        
        // Core Capacitor plugins
        plugins.add(com.capacitor.app.AppPlugin.class);
        plugins.add(com.capacitor.haptics.HapticsPlugin.class);
        plugins.add(com.capacitor.keyboard.KeyboardPlugin.class);
        plugins.add(com.capacitor.preferences.PreferencesPlugin.class);
        plugins.add(com.capacitor.splashscreen.SplashScreenPlugin.class);
        plugins.add(com.capacitor.statusbar.StatusBarPlugin.class);
        
        return plugins;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        // Forward permission results to all plugins
        for (PluginHandle plugin : getBridge().getPlugins()) {
            plugin.getInstance().onRequestPermissionsResult(requestCode, permissions, grantResults);
        }
    }
}