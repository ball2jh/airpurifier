idf_component_register(SRCS "ota_update.c" "api_server.c" "wifi.c" "history.c" "sen55.c" "fan_controller.c" "time_sync.c" "main.c"
                       INCLUDE_DIRS "."
                       PRIV_REQUIRES mdns)
