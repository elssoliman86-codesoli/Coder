package com.onebyte.coder;

import android.app.Application;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import java.util.ArrayList;

public class MainApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        
        // Initialize Capacitor plugins
        registerActivityLifecycleCallbacks(new BridgeActivity.LifecycleCallbacks());
    }

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
}