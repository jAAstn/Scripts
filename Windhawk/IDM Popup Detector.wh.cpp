// ==WindhawkMod==
// @id              idm-popup-detector
// @name            IDM Popup Detector
// @description     Erkennt, wenn das "Download File Info"-Fenster im Internet Download Manager geöffnet wird, und entfernt doppelte Extension endung unter "Save As"
// @version         1.0.0
// @author          jAstn
// @github          https://github.com/jAAstn
// @include         IDMan.exe
// @compilerOptions -luser32
// ==/WindhawkMod==

// ==WindhawkModReadme==
// # IDM Popup Detector
//
// Dieser Mod injiziert sich gezielt in den Prozess `IDMan.exe`. 
// Er überwacht die Windows-API-Funktion `ShowWindow`, um zu erkennen, 
// wann ein Dialogfenster auf dem Bildschirm gezeichnet wird.
// 
// Sobald das "Download File Info" (oder das entsprechende deutsche) 
// Fenster auftaucht, wird ein Eintrag im Windhawk-Log erstellt.
// ==/WindhawkModReadme==

#include <windows.h>
#include <windhawk_api.h>
#include <windhawk_utils.h>
#include <string>

// 1. Definition des Original-Pointers für unsere gehookte Funktion
using ShowWindow_t = decltype(&ShowWindow);
ShowWindow_t ShowWindow_Original;

// Hilfsfunktion: Durchsucht alle Textfelder im Popup nach Pfaden mit doppelten Endungen
BOOL CALLBACK EnumChildProc(HWND hwnd, LPARAM lParam) {
    WCHAR text[1024];
    if (GetWindowTextW(hwnd, text, ARRAYSIZE(text)) > 0) {
        std::wstring wstr(text);
        
        // Heuristik: Ist es ein absoluter Dateipfad? (Enthält ":\" oder beginnt mit "\\")
        if (wstr.find(L":\\") != std::wstring::npos || wstr.find(L"\\\\") == 0) {
            
            // Suche nach dem letzten Punkt in der Zeichenkette
            size_t lastDot = wstr.find_last_of(L'.');
            if (lastDot != std::wstring::npos && lastDot > 0) {
                std::wstring ext1 = wstr.substr(lastDot); // z.B. ".mp4"
                
                // Suche nach dem vorletzten Punkt
                size_t secondLastDot = wstr.find_last_of(L'.', lastDot - 1);
                if (secondLastDot != std::wstring::npos) {
                    std::wstring ext2 = wstr.substr(secondLastDot, lastDot - secondLastDot);
                    
                    // Vergleiche beide Endungen (case-insensitive)
                    if (_wcsicmp(ext1.c_str(), ext2.c_str()) == 0) {
                        // Doppelte Endung gefunden! (z.B. .mp4 und .mp4)
                        wstr.erase(lastDot); // Die letzte Endung abschneiden
                        
                        // Text im IDM Feld überschreiben
                        SetWindowTextW(hwnd, wstr.c_str());
                        Wh_Log(L"[IDM Mod] Doppelte Endung (%s) entfernt. Neuer Pfad: %s", ext1.c_str(), wstr.c_str());
                    }
                }
            }
        }
    }
    return TRUE; // Weitersuchen bei anderen UI-Elementen
}

// 2. Unsere Hook-Funktion, die aufgerufen wird, WÄHREND IDM ein Fenster anzeigt
BOOL WINAPI ShowWindow_Hook(HWND hWnd, int nCmdShow) {
    
    // Zuerst die Originalfunktion aufrufen. Das stellt sicher, dass IDM
    // bereits alle Texte in die Felder geschrieben hat (InitDialog).
    BOOL result = ShowWindow_Original(hWnd, nCmdShow);
    
    // Prüfen, ob das Fenster tatsächlich angezeigt werden soll 
    if (nCmdShow == SW_SHOW || nCmdShow == SW_SHOWNORMAL || nCmdShow == SW_SHOWNA) {
        
        WCHAR title[512];
        if (GetWindowTextW(hWnd, title, ARRAYSIZE(title)) > 0) {
            
            WCHAR className[256];
            GetClassNameW(hWnd, className, ARRAYSIZE(className));

            if (wcscmp(className, L"#32770") == 0) {
                if (wcsstr(title, L"Download File Info") != nullptr || 
                    wcsstr(title, L"Dateidownloadinfo") != nullptr ||
                    wcsstr(title, L"Download-Dateiinfo") != nullptr ||
                    wcsstr(title, L"Datei herunterladen") != nullptr) 
                {
                    Wh_Log(L"[IDM Mod] BINGO! Popup erkannt. Titel: %s", title);
                    
                    // Alle Textfelder dieses Popups durchsuchen und anpassen
                    EnumChildWindows(hWnd, EnumChildProc, 0);
                }
            }
        }
    }
    
    return result;
}

// 3. Initialisierungs-Routine (Wird aufgerufen, wenn IDMan.exe startet oder der Mod aktiviert wird)
BOOL Wh_ModInit() {
    Wh_Log(L"[IDM Mod] Initialisiere Mod für IDMan.exe...");

    // Defensive Programmierung: Verhindern, dass der Mod lädt, wenn der Prozess 
    // ganz frisch startet und noch instabil ist (Thread Environment Block Analyse).
#ifdef _WIN64
    const size_t OFFSET_SAME_TEB_FLAGS = 0x17EE;
#else
    const size_t OFFSET_SAME_TEB_FLAGS = 0x0FCA;
#endif
    bool isInitialThread = *(USHORT*)((BYTE*)NtCurrentTeb() + OFFSET_SAME_TEB_FLAGS) & 0x0400;
    
    if (isInitialThread) {
        Wh_Log(L"[IDM Mod] Zielprozess bootet gerade erst. Breche initiale Injektion zur Sicherheit ab.");
        return FALSE; 
    }

    // Typsicheres Hooking der ShowWindow-Funktion über das WindhawkUtils-Template
    WindhawkUtils::SetFunctionHook(ShowWindow, ShowWindow_Hook, &ShowWindow_Original);

    Wh_Log(L"[IDM Mod] Hook auf ShowWindow erfolgreich gesetzt! Warte auf Popups...");
    return TRUE;
}

// 4. Cleanup-Routine (Wird aufgerufen, wenn der Mod deaktiviert wird)
void Wh_ModUninit() {
    Wh_Log(L"[IDM Mod] Mod wird entladen und Hooks werden entfernt.");
}
