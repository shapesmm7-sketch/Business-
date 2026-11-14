package com.brivu.myapp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothClass;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(
            alias = "bluetoothConnect",
            strings = { Manifest.permission.BLUETOOTH_CONNECT }
        ),
        @Permission(
            alias = "bluetoothScan",
            strings = { Manifest.permission.BLUETOOTH_SCAN }
        ),
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final String TAG = "BluetoothPrinterPlugin";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final long SCAN_DURATION_MS = 3800L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private BluetoothSocket activeSocket = null;
    private String activeSocketAddress = null;

    private BroadcastReceiver activeDiscoveryReceiver = null;
    private ScanCallback activeLeCallback = null;
    private BluetoothLeScanner activeLeScanner = null;
    private Runnable activeScanTimeoutRunnable = null;

    private BluetoothAdapter getBluetoothAdapter() {
        Context ctx = getContext();
        if (ctx == null) return null;
        BluetoothManager manager = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null && manager.getAdapter() != null) {
            return manager.getAdapter();
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private boolean hasRequiredPermissions() {
        Context ctx = getContext();
        if (ctx == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(ctx, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED;
        }
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestRequiredPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAliases(new String[] { "bluetoothConnect", "bluetoothScan" }, call, "permissionsCallback");
        } else {
            requestPermissionForAliases(new String[] { "location" }, call, "permissionsCallback");
        }
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        if (call == null) return;
        if (!hasRequiredPermissions()) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("permissionDenied", true);
            res.put(
                "message",
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    ? "Nearby Devices Bluetooth permission is required to find and connect your thermal printer. Please allow Nearby Devices in Android App Settings."
                    : "Location permission is required by Android to scan nearby Bluetooth printers. Please allow Location permission and try again."
            );
            call.resolve(res);
            return;
        }

        String method = call.getMethodName();
        if ("scanPrinters".equals(method)) {
            scanPrinters(call);
        } else if ("connectPrinter".equals(method)) {
            connectPrinter(call);
        } else if ("printBytes".equals(method)) {
            printBytes(call);
        } else {
            JSObject res = new JSObject();
            res.put("granted", true);
            call.resolve(res);
        }
    }

    @ActivityCallback
    private void enableBluetoothCallback(PluginCall call, ActivityResult result) {
        if (call == null) return;
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null || !adapter.isEnabled() || result.getResultCode() != Activity.RESULT_OK) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("bluetoothDisabled", true);
            res.put("message", "Bluetooth is turned off. Please turn on Bluetooth on your phone and try again.");
            call.resolve(res);
            return;
        }

        String method = call.getMethodName();
        if ("scanPrinters".equals(method)) {
            scanPrinters(call);
        } else if ("connectPrinter".equals(method)) {
            connectPrinter(call);
        } else if ("printBytes".equals(method)) {
            printBytes(call);
        } else {
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("enabled", true);
            call.resolve(res);
        }
    }

    private boolean ensureBluetoothEnabledOrPrompt(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("unsupported", true);
            res.put("message", "Bluetooth hardware is not available on this Android device.");
            call.resolve(res);
            return false;
        }

        if (!adapter.isEnabled()) {
            try {
                @SuppressLint("MissingPermission")
                Intent enableIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
                startActivityForResult(call, enableIntent, "enableBluetoothCallback");
            } catch (Exception e) {
                Log.w(TAG, "Failed to launch ACTION_REQUEST_ENABLE: " + e.getMessage());
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("bluetoothDisabled", true);
                res.put("message", "Bluetooth is turned off. Please turn on Bluetooth in Android Settings and try again.");
                call.resolve(res);
            }
            return false;
        }
        return true;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = getBluetoothAdapter();
        JSObject res = new JSObject();
        res.put("supported", adapter != null);
        res.put("enabled", adapter != null && adapter.isEnabled());
        res.put("hasPermissions", hasRequiredPermissions());
        call.resolve(res);
    }

    @PluginMethod
    @SuppressLint("MissingPermission")
    public void scanPrinters(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestRequiredPermissions(call);
            return;
        }
        if (!ensureBluetoothEnabledOrPrompt(call)) {
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        Context ctx = getContext();
        if (adapter == null || ctx == null) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("devices", new JSArray());
            res.put("message", "Bluetooth adapter is unavailable on this phone.");
            call.resolve(res);
            return;
        }

        stopOngoingDiscovery(adapter);

        final Map<String, JSObject> foundDevices = Collections.synchronizedMap(new LinkedHashMap<>());

        // 1. Collect all paired/bonded devices first (instant, reliable for Classic SPP printers)
        try {
            Set<BluetoothDevice> bonded = adapter.getBondedDevices();
            if (bonded != null) {
                for (BluetoothDevice device : bonded) {
                    if (device != null && device.getAddress() != null) {
                        foundDevices.put(device.getAddress(), toDeviceJSObject(device, true));
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error reading bonded devices: " + e.getMessage());
        }

        final AtomicBoolean finished = new AtomicBoolean(false);

        final Runnable completeScan = () -> {
            if (!finished.compareAndSet(false, true)) return;
            stopOngoingDiscovery(adapter);

            List<JSObject> sorted = new ArrayList<>(foundDevices.values());
            Collections.sort(sorted, (a, b) -> {
                boolean aPrinter = a.optBoolean("isLikelyPrinter", false);
                boolean bPrinter = b.optBoolean("isLikelyPrinter", false);
                if (aPrinter != bPrinter) return aPrinter ? -1 : 1;

                boolean aBonded = a.optBoolean("bonded", false);
                boolean bBonded = b.optBoolean("bonded", false);
                if (aBonded != bBonded) return aBonded ? -1 : 1;

                String aName = a.optString("name", "");
                String bName = b.optString("name", "");
                return aName.compareToIgnoreCase(bName);
            });

            JSArray arr = new JSArray();
            for (JSObject obj : sorted) {
                arr.put(obj);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("devices", arr);
            res.put(
                "message",
                arr.length() > 0
                    ? ("Found " + arr.length() + " Bluetooth device" + (arr.length() == 1 ? "" : "s") + ". Select your thermal printer below.")
                    : "No Bluetooth printers found yet. Turn on your physical printer and tap Scan Again, or pair it in Android Bluetooth Settings."
            );
            call.resolve(res);
        };

        // 2. Active Classic & Dual-mode discovery for nearby unpaired printers
        try {
            BroadcastReceiver receiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (intent == null) return;
                    String action = intent.getAction();
                    if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                        @SuppressWarnings("deprecation")
                        BluetoothDevice device = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                        if (device != null && device.getAddress() != null) {
                            boolean isBonded = device.getBondState() == BluetoothDevice.BOND_BONDED;
                            JSObject existing = foundDevices.get(device.getAddress());
                            JSObject obj = toDeviceJSObject(device, isBonded);
                            // Keep non-empty name if already discovered
                            if (existing != null && obj.optString("name", "").startsWith("Bluetooth Device")) {
                                String prevName = existing.optString("name", "");
                                if (!prevName.isEmpty()) obj.put("name", prevName);
                            }
                            foundDevices.put(device.getAddress(), obj);
                        }
                    } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                        mainHandler.post(completeScan);
                    }
                }
            };

            activeDiscoveryReceiver = receiver;
            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothDevice.ACTION_FOUND);
            filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
            ContextCompat.registerReceiver(ctx, receiver, filter, ContextCompat.RECEIVER_EXPORTED);

            if (adapter.isDiscovering()) {
                adapter.cancelDiscovery();
            }
            adapter.startDiscovery();
        } catch (Exception e) {
            Log.w(TAG, "Classic Bluetooth discovery start note: " + e.getMessage());
        }

        // 3. Also run parallel BLE scan so BLE-only mini thermal printers appear
        try {
            BluetoothLeScanner leScanner = adapter.getBluetoothLeScanner();
            if (leScanner != null) {
                activeLeScanner = leScanner;
                activeLeCallback = new ScanCallback() {
                    @Override
                    public void onScanResult(int callbackType, ScanResult result) {
                        if (result == null || result.getDevice() == null) return;
                        BluetoothDevice device = result.getDevice();
                        String addr = device.getAddress();
                        if (addr == null) return;
                        String devName = null;
                        try {
                            devName = device.getName();
                        } catch (Exception ignored) {}
                        if ((devName == null || devName.trim().isEmpty()) && result.getScanRecord() != null) {
                            devName = result.getScanRecord().getDeviceName();
                        }
                        if (devName == null || devName.trim().isEmpty()) {
                            return; // Skip unnamed BLE beacons
                        }
                        boolean isBonded = device.getBondState() == BluetoothDevice.BOND_BONDED;
                        if (!foundDevices.containsKey(addr)) {
                            JSObject obj = toDeviceJSObject(device, isBonded);
                            obj.put("name", devName.trim());
                            obj.put("isLikelyPrinter", isLikelyThermalPrinter(devName, device.getBluetoothClass()));
                            foundDevices.put(addr, obj);
                        }
                    }
                };
                leScanner.startScan(activeLeCallback);
            }
        } catch (Exception e) {
            Log.w(TAG, "BLE scan start note: " + e.getMessage());
        }

        activeScanTimeoutRunnable = completeScan;
        mainHandler.postDelayed(completeScan, SCAN_DURATION_MS);
    }

    @PluginMethod
    @SuppressLint("MissingPermission")
    public void connectPrinter(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestRequiredPermissions(call);
            return;
        }
        if (!ensureBluetoothEnabledOrPrompt(call)) {
            return;
        }

        String address = call.getString("address");
        if (address == null || address.trim().isEmpty()) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "Printer Bluetooth address is required.");
            call.resolve(res);
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "Bluetooth adapter unavailable.");
            call.resolve(res);
            return;
        }

        final String targetAddress = address.trim();
        executor.execute(() -> {
            try {
                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                }

                BluetoothDevice device = adapter.getRemoteDevice(targetAddress);
                if (device == null) {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("message", "Printer device not found at address " + targetAddress + ".");
                    call.resolve(res);
                    return;
                }

                String devName = getSafeDeviceName(device);
                int devType = BluetoothDevice.DEVICE_TYPE_CLASSIC;
                try {
                    devType = device.getType();
                } catch (Exception ignored) {}

                String transport = null;

                // Try Classic SPP / RFCOMM first for Classic & Dual-Mode ESC/POS printers
                if (devType != BluetoothDevice.DEVICE_TYPE_LE) {
                    BluetoothSocket socket = openRfcommSocket(device, targetAddress);
                    if (socket != null) {
                        transport = "spp";
                    }
                }

                // Fallback to BLE GATT if BLE-only or if SPP failed
                if (transport == null) {
                    boolean gattOk = verifyBleGattPrinter(device);
                    if (gattOk) {
                        transport = "gatt";
                    }
                }

                if (transport != null) {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("name", devName);
                    res.put("address", targetAddress);
                    res.put("transport", transport);
                    res.put("message", "Connected to \"" + devName + "\" successfully!");
                    call.resolve(res);
                } else {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put(
                        "message",
                        "Could not connect to \"" + devName + "\". Make sure the printer is powered ON, within range, and paired in Android Bluetooth Settings (PIN is usually 0000 or 1234)."
                    );
                    call.resolve(res);
                }
            } catch (Exception e) {
                Log.e(TAG, "connectPrinter error: " + e.getMessage(), e);
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("message", "Connection error: " + (e.getMessage() != null ? e.getMessage() : "Printer unreachable. Verify it is powered on."));
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    @SuppressLint("MissingPermission")
    public void printBytes(PluginCall call) {
        if (!hasRequiredPermissions()) {
            requestRequiredPermissions(call);
            return;
        }
        if (!ensureBluetoothEnabledOrPrompt(call)) {
            return;
        }

        String address = call.getString("address");
        String base64Data = call.getString("base64Data");
        if (address == null || address.trim().isEmpty()) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "No saved printer address found. Please connect a Bluetooth printer in Settings.");
            call.resolve(res);
            return;
        }
        if (base64Data == null || base64Data.isEmpty()) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "No receipt print data was provided.");
            call.resolve(res);
            return;
        }

        final byte[] payload;
        try {
            payload = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (Exception e) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "Failed to decode receipt print bytes.");
            call.resolve(res);
            return;
        }

        BluetoothAdapter adapter = getBluetoothAdapter();
        if (adapter == null) {
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("message", "Bluetooth adapter is unavailable.");
            call.resolve(res);
            return;
        }

        final String targetAddress = address.trim();
        executor.execute(() -> {
            try {
                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                }

                BluetoothDevice device = adapter.getRemoteDevice(targetAddress);
                if (device == null) {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put("message", "Saved Bluetooth printer was not found. Please search and connect again in Settings.");
                    call.resolve(res);
                    return;
                }

                String devName = getSafeDeviceName(device);
                int devType = BluetoothDevice.DEVICE_TYPE_CLASSIC;
                try {
                    devType = device.getType();
                } catch (Exception ignored) {}

                boolean printed = false;
                String lastError = null;

                // 1. Try Classic SPP / RFCOMM
                if (devType != BluetoothDevice.DEVICE_TYPE_LE) {
                    try {
                        writeOverRfcomm(device, targetAddress, payload);
                        printed = true;
                    } catch (Exception sppErr) {
                        lastError = sppErr.getMessage();
                        Log.w(TAG, "SPP write failed for " + targetAddress + ": " + lastError);
                    }
                }

                // 2. Fallback / BLE GATT write
                if (!printed) {
                    try {
                        printed = writeOverBleGatt(device, payload);
                    } catch (Exception gattErr) {
                        if (lastError == null) lastError = gattErr.getMessage();
                        Log.w(TAG, "BLE GATT write failed for " + targetAddress + ": " + gattErr.getMessage());
                    }
                }

                if (printed) {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("message", "Printed successfully to " + devName + "!");
                    call.resolve(res);
                } else {
                    JSObject res = new JSObject();
                    res.put("success", false);
                    res.put(
                        "message",
                        "Could not print to \"" + devName + "\": " + (lastError != null ? lastError : "Printer offline or out of range.") + " Please verify the printer is powered ON."
                    );
                    call.resolve(res);
                }
            } catch (Exception e) {
                Log.e(TAG, "printBytes unexpected error: " + e.getMessage(), e);
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("message", "Thermal print error: " + (e.getMessage() != null ? e.getMessage() : "Check printer connection."));
                call.resolve(res);
            }
        });
    }

    @PluginMethod
    public void disconnectPrinter(PluginCall call) {
        executor.execute(() -> {
            closeActiveSocket();
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        });
    }

    @SuppressLint("MissingPermission")
    private synchronized BluetoothSocket openRfcommSocket(BluetoothDevice device, String address) {
        if (activeSocket != null && address.equalsIgnoreCase(activeSocketAddress) && activeSocket.isConnected()) {
            return activeSocket;
        }
        closeActiveSocket();

        // Attempt 1: Standard secure SPP RFCOMM socket
        try {
            BluetoothSocket s1 = device.createRfcommSocketToServiceRecord(SPP_UUID);
            s1.connect();
            activeSocket = s1;
            activeSocketAddress = address;
            return s1;
        } catch (Exception e1) {
            Log.d(TAG, "Secure SPP connect failed, trying insecure SPP: " + e1.getMessage());
        }

        // Attempt 2: Insecure SPP RFCOMM socket (common on Android 10+ POS printers without MITM pairing)
        try {
            BluetoothSocket s2 = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            s2.connect();
            activeSocket = s2;
            activeSocketAddress = address;
            return s2;
        } catch (Exception e2) {
            Log.d(TAG, "Insecure SPP connect failed, trying RFCOMM channel 1 fallback: " + e2.getMessage());
        }

        // Attempt 3: Direct RFCOMM Channel 1 reflection fallback (fixes buggy SDP tables on Chinese POS printers)
        try {
            Method m = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket s3 = (BluetoothSocket) m.invoke(device, 1);
            if (s3 != null) {
                s3.connect();
                activeSocket = s3;
                activeSocketAddress = address;
                return s3;
            }
        } catch (Exception e3) {
            Log.w(TAG, "Channel 1 RFCOMM fallback failed: " + e3.getMessage());
        }

        return null;
    }

    private void writeOverRfcomm(BluetoothDevice device, String address, byte[] payload) throws IOException {
        boolean reusedSocket = activeSocket != null && address.equalsIgnoreCase(activeSocketAddress) && activeSocket.isConnected();
        BluetoothSocket socket = openRfcommSocket(device, address);
        if (socket == null) {
            throw new IOException("Unable to open Bluetooth SPP connection to printer.");
        }

        try {
            writeChunksToSocket(socket, payload);
        } catch (IOException writeErr) {
            if (reusedSocket) {
                // Cached socket was stale (printer slept/restarted) — open a fresh socket and retry once
                closeActiveSocket();
                BluetoothSocket fresh = openRfcommSocket(device, address);
                if (fresh == null) {
                    throw writeErr;
                }
                writeChunksToSocket(fresh, payload);
            } else {
                closeActiveSocket();
                throw writeErr;
            }
        }
    }

    private void writeChunksToSocket(BluetoothSocket socket, byte[] payload) throws IOException {
        OutputStream os = socket.getOutputStream();
        if (os == null) {
            throw new IOException("Printer output stream is unavailable.");
        }
        final int chunkSize = 512;
        for (int offset = 0; offset < payload.length; offset += chunkSize) {
            int len = Math.min(chunkSize, payload.length - offset);
            os.write(payload, offset, len);
            os.flush();
            if (offset + len < payload.length) {
                try {
                    Thread.sleep(20);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }
            }
        }
        os.flush();
    }

    private synchronized void closeActiveSocket() {
        if (activeSocket != null) {
            try {
                activeSocket.close();
            } catch (Exception ignored) {}
            activeSocket = null;
            activeSocketAddress = null;
        }
    }

    @SuppressLint("MissingPermission")
    private boolean verifyBleGattPrinter(BluetoothDevice device) {
        Context ctx = getContext();
        if (ctx == null) return false;

        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicBoolean writableFound = new AtomicBoolean(false);
        final AtomicReference<BluetoothGatt> gattRef = new AtomicReference<>();

        BluetoothGattCallback callback = new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(@NonNull BluetoothGatt gatt, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    gatt.discoverServices();
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                    latch.countDown();
                }
            }

            @Override
            public void onServicesDiscovered(@NonNull BluetoothGatt gatt, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    writableFound.set(findWritableCharacteristic(gatt) != null);
                }
                latch.countDown();
            }
        };

        try {
            BluetoothGatt gatt = device.connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE);
            gattRef.set(gatt);
            latch.await(6, TimeUnit.SECONDS);
        } catch (Exception e) {
            Log.w(TAG, "BLE verify note: " + e.getMessage());
        } finally {
            BluetoothGatt gatt = gattRef.get();
            if (gatt != null) {
                try {
                    gatt.disconnect();
                    gatt.close();
                } catch (Exception ignored) {}
            }
        }

        return writableFound.get();
    }

    @SuppressLint("MissingPermission")
    private boolean writeOverBleGatt(BluetoothDevice device, byte[] payload) {
        Context ctx = getContext();
        if (ctx == null) return false;

        final CountDownLatch readyLatch = new CountDownLatch(1);
        final AtomicReference<BluetoothGatt> gattRef = new AtomicReference<>();
        final AtomicReference<BluetoothGattCharacteristic> charRef = new AtomicReference<>();
        final AtomicReference<CountDownLatch> writeLatchRef = new AtomicReference<>();
        final AtomicBoolean writeSuccess = new AtomicBoolean(true);

        BluetoothGattCallback callback = new BluetoothGattCallback() {
            @Override
            public void onConnectionStateChange(@NonNull BluetoothGatt gatt, int status, int newState) {
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    gatt.discoverServices();
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                    readyLatch.countDown();
                    CountDownLatch wl = writeLatchRef.get();
                    if (wl != null) wl.countDown();
                }
            }

            @Override
            public void onServicesDiscovered(@NonNull BluetoothGatt gatt, int status) {
                if (status == BluetoothGatt.GATT_SUCCESS) {
                    charRef.set(findWritableCharacteristic(gatt));
                }
                readyLatch.countDown();
            }

            @Override
            public void onCharacteristicWrite(BluetoothGatt gatt, BluetoothGattCharacteristic characteristic, int status) {
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    writeSuccess.set(false);
                }
                CountDownLatch wl = writeLatchRef.get();
                if (wl != null) wl.countDown();
            }
        };

        try {
            BluetoothGatt gatt = device.connectGatt(ctx, false, callback, BluetoothDevice.TRANSPORT_LE);
            gattRef.set(gatt);
            if (!readyLatch.await(7, TimeUnit.SECONDS)) {
                return false;
            }
            BluetoothGattCharacteristic writable = charRef.get();
            if (writable == null) {
                return false;
            }

            int props = writable.getProperties();
            int writeType = (props & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
            writable.setWriteType(writeType);

            final int chunkSize = 100;
            for (int offset = 0; offset < payload.length; offset += chunkSize) {
                int len = Math.min(chunkSize, payload.length - offset);
                byte[] chunk = new byte[len];
                System.arraycopy(payload, offset, chunk, 0, len);

                CountDownLatch wl = new CountDownLatch(1);
                writeLatchRef.set(wl);

                boolean initiated;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    int code = gatt.writeCharacteristic(writable, chunk, writeType);
                    initiated = (code == android.bluetooth.BluetoothStatusCodes.SUCCESS);
                } else {
                    @SuppressWarnings("deprecation")
                    boolean ok = writable.setValue(chunk) && gatt.writeCharacteristic(writable);
                    initiated = ok;
                }

                if (!initiated) {
                    writeSuccess.set(false);
                    break;
                }

                wl.await(1500, TimeUnit.MILLISECONDS);
                Thread.sleep(25);
                if (!writeSuccess.get()) {
                    break;
                }
            }
            return writeSuccess.get();
        } catch (Exception e) {
            Log.w(TAG, "writeOverBleGatt error: " + e.getMessage());
            return false;
        } finally {
            BluetoothGatt gatt = gattRef.get();
            if (gatt != null) {
                try {
                    gatt.disconnect();
                    gatt.close();
                } catch (Exception ignored) {}
            }
        }
    }

    private BluetoothGattCharacteristic findWritableCharacteristic(BluetoothGatt gatt) {
        if (gatt == null || gatt.getServices() == null) return null;
        for (BluetoothGattService service : gatt.getServices()) {
            if (service == null || service.getCharacteristics() == null) continue;
            for (BluetoothGattCharacteristic ch : service.getCharacteristics()) {
                int props = ch.getProperties();
                if ((props & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
                    || (props & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) {
                    return ch;
                }
            }
        }
        return null;
    }

    @SuppressLint("MissingPermission")
    private void stopOngoingDiscovery(BluetoothAdapter adapter) {
        if (activeScanTimeoutRunnable != null) {
            mainHandler.removeCallbacks(activeScanTimeoutRunnable);
            activeScanTimeoutRunnable = null;
        }
        if (activeDiscoveryReceiver != null && getContext() != null) {
            try {
                getContext().unregisterReceiver(activeDiscoveryReceiver);
            } catch (Exception ignored) {}
            activeDiscoveryReceiver = null;
        }
        if (activeLeScanner != null && activeLeCallback != null) {
            try {
                activeLeScanner.stopScan(activeLeCallback);
            } catch (Exception ignored) {}
            activeLeCallback = null;
            activeLeScanner = null;
        }
        if (adapter != null) {
            try {
                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                }
            } catch (Exception ignored) {}
        }
    }

    @SuppressLint("MissingPermission")
    private JSObject toDeviceJSObject(BluetoothDevice device, boolean bonded) {
        JSObject obj = new JSObject();
        String name = getSafeDeviceName(device);
        BluetoothClass btClass = null;
        try {
            btClass = device.getBluetoothClass();
        } catch (Exception ignored) {}

        obj.put("name", name);
        obj.put("address", device.getAddress());
        obj.put("bonded", bonded);
        obj.put("isLikelyPrinter", isLikelyThermalPrinter(name, btClass));
        return obj;
    }

    @SuppressLint("MissingPermission")
    private String getSafeDeviceName(BluetoothDevice device) {
        try {
            String n = device.getName();
            if (n != null && !n.trim().isEmpty()) {
                return n.trim();
            }
        } catch (Exception ignored) {}
        String addr = device.getAddress();
        if (addr != null && addr.length() >= 5) {
            return "Bluetooth Printer (" + addr.substring(addr.length() - 5) + ")";
        }
        return "Bluetooth Printer";
    }

    private boolean isLikelyThermalPrinter(String name, BluetoothClass btClass) {
        if (btClass != null && btClass.getMajorDeviceClass() == BluetoothClass.Device.Major.IMAGING) {
            return true;
        }
        if (name == null) return false;
        String lower = name.toLowerCase();
        String[] keywords = {
            "printer", "print", "pos", "mpt", "xprinter", "xp-", "gooj", "zj", "zjiang",
            "rpp", "btp", "sprt", "gp-", "thermal", "esc", "star", "epson", "bixolon",
            "sunmi", "inner", "mtp", "bluetooth", "58mm", "80mm", "mini", "label", "nyear"
        };
        for (String kw : keywords) {
            if (lower.contains(kw)) return true;
        }
        return false;
    }

    @Override
    protected void handleOnDestroy() {
        stopOngoingDiscovery(getBluetoothAdapter());
        closeActiveSocket();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
