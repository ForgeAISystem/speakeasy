#include <ApplicationServices/ApplicationServices.h>
#include <libproc.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// Window Pad helper. One command per run, one JSON line out.
//   front                      the focused window of the frontmost app
//   move <pid> <x> <y> <w> <h> place that app's focused (or main) window
//   list                       on-screen app windows, front to back, one per app
//   frame <pid>                that app's focused (or main) window frame
// Reads window frames and app names only. No window titles or contents.

static void jsonString(const char *s) {
  putchar('"');
  for (; s && *s; s++) {
    if (*s == '"' || *s == '\\') { putchar('\\'); putchar(*s); }
    else if ((unsigned char)*s < 0x20) printf("\\u%04x", *s);
    else putchar(*s);
  }
  putchar('"');
}

static void cfString(CFStringRef value, char *out, size_t size) {
  out[0] = 0;
  if (value) CFStringGetCString(value, out, size, kCFStringEncodingUTF8);
}

static void execPath(pid_t pid, char *out) {
  out[0] = 0;
  if (proc_pidpath(pid, out, PROC_PIDPATHINFO_MAXSIZE) <= 0) out[0] = 0;
}

static AXUIElementRef windowOf(AXUIElementRef app) {
  CFTypeRef win = NULL;
  if (AXUIElementCopyAttributeValue(app, kAXFocusedWindowAttribute, &win) == kAXErrorSuccess && win) return (AXUIElementRef)win;
  if (AXUIElementCopyAttributeValue(app, kAXMainWindowAttribute, &win) == kAXErrorSuccess && win) return (AXUIElementRef)win;
  CFTypeRef list = NULL;
  if (AXUIElementCopyAttributeValue(app, kAXWindowsAttribute, &list) == kAXErrorSuccess && list) {
    AXUIElementRef first = NULL;
    if (CFArrayGetCount(list) > 0) first = (AXUIElementRef)CFRetain(CFArrayGetValueAtIndex(list, 0));
    CFRelease(list);
    return first;
  }
  return NULL;
}

static bool frameOf(AXUIElementRef win, CGPoint *pos, CGSize *size) {
  CFTypeRef p = NULL, s = NULL;
  bool ok = AXUIElementCopyAttributeValue(win, kAXPositionAttribute, &p) == kAXErrorSuccess
         && AXUIElementCopyAttributeValue(win, kAXSizeAttribute, &s) == kAXErrorSuccess
         && AXValueGetValue(p, kAXValueCGPointType, pos)
         && AXValueGetValue(s, kAXValueCGSizeType, size);
  if (p) CFRelease(p);
  if (s) CFRelease(s);
  return ok;
}

static int fail(const char *message) {
  printf("{\"ok\":false,\"error\":");
  jsonString(message);
  puts("}");
  return 1;
}

static int front(void) {
  AXUIElementRef system = AXUIElementCreateSystemWide();
  CFTypeRef app = NULL;
  AXError err = AXUIElementCopyAttributeValue(system, kAXFocusedApplicationAttribute, &app);
  CFRelease(system);
  if (err != kAXErrorSuccess || !app) return fail(err == kAXErrorAPIDisabled ? "accessibility" : "no-front-app");
  pid_t pid = 0;
  AXUIElementGetPid(app, &pid);
  char name[256], path[PROC_PIDPATHINFO_MAXSIZE];
  CFTypeRef title = NULL;
  AXUIElementCopyAttributeValue(app, kAXTitleAttribute, &title);
  cfString(title, name, sizeof name);
  if (title) CFRelease(title);
  execPath(pid, path);
  AXUIElementRef win = windowOf(app);
  CFRelease(app);
  CGPoint pos = {0, 0};
  CGSize size = {0, 0};
  bool hasFrame = win && frameOf(win, &pos, &size);
  if (win) CFRelease(win);
  printf("{\"ok\":true,\"pid\":%d,\"app\":", pid);
  jsonString(name);
  printf(",\"exec\":");
  jsonString(path);
  if (hasFrame) printf(",\"x\":%.0f,\"y\":%.0f,\"w\":%.0f,\"h\":%.0f", pos.x, pos.y, size.width, size.height);
  puts("}");
  return 0;
}

static int move(pid_t pid, CGPoint pos, CGSize size) {
  AXUIElementRef app = AXUIElementCreateApplication(pid);
  AXUIElementRef win = windowOf(app);
  if (!win) { CFRelease(app); return fail("no-window"); }
  CFTypeRef minimized = NULL;
  if (AXUIElementCopyAttributeValue(win, kAXMinimizedAttribute, &minimized) == kAXErrorSuccess && minimized) {
    if (CFBooleanGetValue(minimized)) AXUIElementSetAttributeValue(win, kAXMinimizedAttribute, kCFBooleanFalse);
    CFRelease(minimized);
  }
  AXValueRef p = AXValueCreate(kAXValueCGPointType, &pos);
  AXValueRef s = AXValueCreate(kAXValueCGSizeType, &size);
  // Size, move, size again: a window crossing displays can be clamped by the
  // old screen on the first resize.
  AXUIElementSetAttributeValue(win, kAXSizeAttribute, s);
  AXError err = AXUIElementSetAttributeValue(win, kAXPositionAttribute, p);
  AXUIElementSetAttributeValue(win, kAXSizeAttribute, s);
  CFRelease(p);
  CFRelease(s);
  AXUIElementPerformAction(win, kAXRaiseAction);
  AXUIElementSetAttributeValue(app, kAXFrontmostAttribute, kCFBooleanTrue);
  CGPoint got = pos;
  CGSize gotSize = size;
  frameOf(win, &got, &gotSize);
  CFRelease(win);
  CFRelease(app);
  if (err != kAXErrorSuccess) return fail(err == kAXErrorAPIDisabled ? "accessibility" : "not-movable");
  printf("{\"ok\":true,\"x\":%.0f,\"y\":%.0f,\"w\":%.0f,\"h\":%.0f}\n", got.x, got.y, gotSize.width, gotSize.height);
  return 0;
}

static int list(pid_t self) {
  CFArrayRef windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
  if (!windows) return fail("no-windows");
  pid_t seen[256];
  int count = 0;
  printf("{\"ok\":true,\"windows\":[");
  for (CFIndex i = 0; i < CFArrayGetCount(windows) && count < 256; i++) {
    CFDictionaryRef info = CFArrayGetValueAtIndex(windows, i);
    int layer = 1, pid = 0;
    CFNumberRef n = CFDictionaryGetValue(info, kCGWindowLayer);
    if (n) CFNumberGetValue(n, kCFNumberIntType, &layer);
    n = CFDictionaryGetValue(info, kCGWindowOwnerPID);
    if (n) CFNumberGetValue(n, kCFNumberIntType, &pid);
    if (layer != 0 || pid == self || pid == getppid()) continue;
    bool dup = false;
    for (int j = 0; j < count; j++) if (seen[j] == pid) dup = true;
    if (dup) continue;
    CGRect r;
    CFDictionaryRef bounds = CFDictionaryGetValue(info, kCGWindowBounds);
    if (!bounds || !CGRectMakeWithDictionaryRepresentation(bounds, &r) || r.size.width < 120 || r.size.height < 80) continue;
    char name[256], path[PROC_PIDPATHINFO_MAXSIZE];
    cfString(CFDictionaryGetValue(info, kCGWindowOwnerName), name, sizeof name);
    execPath(pid, path);
    if (!path[0]) continue;
    printf("%s{\"pid\":%d,\"app\":", count ? "," : "", pid);
    jsonString(name);
    printf(",\"exec\":");
    jsonString(path);
    printf(",\"x\":%.0f,\"y\":%.0f,\"w\":%.0f,\"h\":%.0f}", r.origin.x, r.origin.y, r.size.width, r.size.height);
    seen[count++] = pid;
  }
  puts("]}");
  CFRelease(windows);
  return 0;
}

static int frame(pid_t pid) {
  AXUIElementRef app = AXUIElementCreateApplication(pid);
  AXUIElementRef win = windowOf(app);
  CFRelease(app);
  if (!win) return fail("no-window");
  CGPoint pos;
  CGSize size;
  bool ok = frameOf(win, &pos, &size);
  CFRelease(win);
  if (!ok) return fail("no-frame");
  printf("{\"ok\":true,\"x\":%.0f,\"y\":%.0f,\"w\":%.0f,\"h\":%.0f}\n", pos.x, pos.y, size.width, size.height);
  return 0;
}

int main(int argc, char **argv) {
  if (argc > 1 && strcmp(argv[1], "front") == 0) return front();
  if (argc > 1 && strcmp(argv[1], "list") == 0) return list(getpid());
  if (argc == 3 && strcmp(argv[1], "frame") == 0) return frame((pid_t)atoi(argv[2]));
  if (argc == 7 && strcmp(argv[1], "move") == 0) {
    CGPoint pos = { atof(argv[3]), atof(argv[4]) };
    CGSize size = { atof(argv[5]), atof(argv[6]) };
    return move((pid_t)atoi(argv[2]), pos, size);
  }
  return fail("usage: front | list | frame <pid> | move <pid> <x> <y> <w> <h>");
}
