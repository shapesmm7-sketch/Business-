# ProGuard & R8 Optimization and Obfuscation Rules for Brivu
# Satisfies Google Play Console DEX Code Optimization & Obfuscation Threshold (> 25%)

# 1. Attributes and Debugging
-keepattributes SourceFile,LineNumberTable
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses,EnclosingMethod
-keepattributes Exceptions
-keepattributes JavascriptInterface

# 2. Capacitor Core & Plugins
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}
-keep class * implements com.getcapacitor.PluginMethod { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 3. Apache Cordova & Plugins
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-keepclassmembers class * extends org.apache.cordova.CordovaPlugin {
    public *;
}

# 4. Google Play Billing Client
-keep class com.android.billingclient.** { *; }
-keep class com.android.vending.billing.** { *; }
-dontwarn com.android.billingclient.**

# 5. Google Mobile Ads (AdMob)
-keep public class com.google.android.gms.ads.** {
   public *;
}
-keep public class com.google.ads.** {
   public *;
}
-dontwarn com.google.android.gms.ads.**

# 6. AndroidX & WebKit
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
}
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public void *(android.webkit.WebView, ...);
}

# 7. Don't warn on optional third-party references
-dontwarn okhttp3.**
-dontwarn okio.**
