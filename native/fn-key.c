#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

// Only Fn transitions and Escape leave this process. No typed text is collected.
static CFMachPortRef tap;
static bool fnDown = false;
static pid_t parent;

static void emit(const char *event) {
  printf("{\"event\":\"%s\"}\n", event);
  fflush(stdout);
}

static CGEventRef handle(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *info) {
  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    fnDown = false;
    emit("reset");
    CGEventTapEnable(tap, true);
    return event;
  }
  if (type == kCGEventKeyDown && CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) == 53) {
    emit("cancel");
  }
  if (type == kCGEventFlagsChanged && CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) == 63) {
    bool down = (CGEventGetFlags(event) & kCGEventFlagMaskSecondaryFn) != 0;
    if (down != fnDown) { fnDown = down; emit(down ? "down" : "up"); }
    // Claim the standalone dictation key so macOS does not open its Globe menu.
    return NULL;
  }
  return event;
}

static void checkParent(CFRunLoopTimerRef timer, void *info) {
  if (getppid() != parent) { CFRunLoopStop(CFRunLoopGetCurrent()); return; }
  if (!CGEventTapIsEnabled(tap)) {
    fnDown = false;
    emit("reset");
    CGEventTapEnable(tap, true);
    if (!CGEventTapIsEnabled(tap)) {
      emit("permission-required");
      CFRunLoopStop(CFRunLoopGetCurrent());
      return;
    }
  }
  emit("heartbeat");
}

int main(int argc, char **argv) {
  if (argc > 1 && strcmp(argv[1], "--check") == 0) {
    puts("{\"available\":true}");
    return 0;
  }
  parent = getppid();
  CGEventMask mask = CGEventMaskBit(kCGEventFlagsChanged) | CGEventMaskBit(kCGEventKeyDown);
  tap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault, mask, handle, NULL);
  if (!tap) { emit("permission-required"); return 1; }
  CFRunLoopSourceRef source = CFMachPortCreateRunLoopSource(NULL, tap, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
  CFRunLoopTimerRef timer = CFRunLoopTimerCreate(NULL, CFAbsoluteTimeGetCurrent() + 2, 2, 0, 0, checkParent, NULL);
  CFRunLoopAddTimer(CFRunLoopGetCurrent(), timer, kCFRunLoopCommonModes);
  CGEventTapEnable(tap, true);
  emit("ready");
  CFRunLoopRun();
  CFRelease(timer);
  CFRelease(source);
  CFRelease(tap);
  return 0;
}
