# Proguard rules for WiFiShare Android Application

# Netty rules for Ktor
-dontwarn io.netty.**
-keep class io.netty.** { *; }

# Ktor rules
-dontwarn io.ktor.**
-keep class io.ktor.** { *; }

# Kotlinx Serialization
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# Coroutines
-dontwarn kotlinx.coroutines.**
-keep class kotlinx.coroutines.** { *; }

# Room
-dontwarn androidx.room.**
-keep class * extends androidx.room.RoomDatabase
