
> @process-engine/process_engine_core@12.10.2 report-test-coverage /Users/5Minds/_dev/Arbeit/Process-Engine/Backend/process_engine/process_engine_core
> c8 report

------------------------------------------------------------------|----------|----------|----------|----------|-------------------|
File                                                              |  % Stmts | % Branch |  % Funcs |  % Lines | Uncovered Line #s |
------------------------------------------------------------------|----------|----------|----------|----------|-------------------|
All files                                                         |       41 |    75.26 |    26.15 |       41 |                   |
 model                                                            |    96.24 |    69.05 |      100 |    96.24 |                   |
  bpmn_model_parser.ts                                            |      100 |       80 |      100 |      100 |             33,38 |
  type_factory.ts                                                 |    95.07 |    65.63 |      100 |    95.07 |... 67,132,133,134 |
 model/parser                                                     |      100 |    77.19 |      100 |      100 |                   |
  collaboration_parser.ts                                         |      100 |       80 |      100 |      100 |                18 |
  definitions_parser.ts                                           |      100 |    71.43 |      100 |      100 |             16,28 |
  flow_node_parser.ts                                             |      100 |       75 |      100 |      100 |                14 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  process_lane_set_parser.ts                                      |      100 |       75 |      100 |      100 |       15,25,35,44 |
  process_parser.ts                                               |      100 |    70.59 |      100 |      100 |   47,60,78,89,102 |
  sequence_flow_parser.ts                                         |      100 |      100 |      100 |      100 |                   |
 model/parser/flow_node_parsers                                   |    95.19 |    63.86 |    94.12 |    95.19 |                   |
  activity_parser.ts                                              |      100 |       75 |      100 |      100 |                23 |
  event_parser.ts                                                 |    93.92 |    59.09 |    92.31 |    93.92 |... 93,294,295,296 |
  gateway_parser.ts                                               |      100 |       80 |      100 |      100 |             24,35 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
 model/parser/flow_node_parsers/activity_parsers                  |    78.14 |    67.18 |    85.71 |    78.14 |                   |
  activity_factory.ts                                             |      100 |       60 |      100 |      100 |             14,17 |
  call_activity_parser.ts                                         |    82.14 |    64.29 |      100 |    82.14 |... 50,53,54,55,56 |
  empty_activity_parser.ts                                        |      100 |     87.5 |      100 |      100 |                15 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  manual_task_parser.ts                                           |      100 |    85.71 |      100 |      100 |                16 |
  receive_task_parser.ts                                          |    51.02 |       60 |       50 |    51.02 |... 38,40,41,42,43 |
  script_task_parser.ts                                           |      100 |     87.5 |      100 |      100 |                17 |
  send_task_parser.ts                                             |    51.02 |       60 |       50 |    51.02 |... 38,40,41,42,43 |
  service_task_parser.ts                                          |    75.76 |    68.42 |       75 |    75.76 |... 69,70,71,72,73 |
  subprocess_parser.ts                                            |    58.33 |       60 |      100 |    58.33 |... 32,33,34,35,36 |
  user_task_parser.ts                                             |    83.15 |    59.62 |    91.67 |    83.15 |... 75,176,177,178 |
 runtime                                                          |     26.3 |      100 |      2.5 |     26.3 |                   |
  auto_start_service.ts                                           |     41.4 |      100 |        0 |     41.4 |... 60,161,162,163 |
  cronjob_service.ts                                              |    18.94 |      100 |        0 |    18.94 |... 72,273,274,275 |
  execute_process_service.ts                                      |    24.11 |      100 |        0 |    24.11 |... 04,305,306,307 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  resume_process_serivce.ts                                       |       25 |      100 |        0 |       25 |... 59,260,261,262 |
 runtime/facades                                                  |    60.98 |    71.88 |    62.79 |    60.98 |                   |
  flow_node_persistence_facade.ts                                 |      100 |      100 |      100 |      100 |                   |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  process_instance_state_handling_facade.ts                       |    42.76 |      100 |        0 |    42.76 |... 44,245,246,247 |
  process_model_facade.ts                                         |    95.17 |    66.07 |     97.3 |    95.17 |... ,47,50,196,199 |
  process_model_facade_factory.ts                                 |    91.67 |      100 |        0 |    91.67 |                 5 |
  process_token_facade.ts                                         |    96.91 |    63.16 |       90 |    96.91 |          20,57,58 |
  process_token_facade_factory.ts                                 |    72.73 |      100 |        0 |    72.73 |             4,5,6 |
  sub_process_model_facade.ts                                     |    23.66 |      100 |        0 |    23.66 |... 80,81,82,83,84 |
  timer_facade.ts                                                 |    12.77 |      100 |     8.33 |    12.77 |... 71,272,273,274 |
 runtime/flow_node_handler                                        |    47.24 |      100 |     4.35 |    47.24 |                   |
  flow_node_handler.ts                                            |    52.75 |      100 |        0 |    52.75 |... 96,197,198,199 |
  flow_node_handler_factory.ts                                    |    26.73 |      100 |        0 |    26.73 |... 83,84,85,86,87 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
 runtime/flow_node_handler/activity_handler                       |    25.33 |      100 |        1 |    25.33 |                   |
  activity_handler.ts                                             |    24.81 |      100 |        0 |    24.81 |... 86,587,588,589 |
  call_activity_handler.ts                                        |    23.63 |      100 |        0 |    23.63 |... 57,258,259,260 |
  empty_activity_handler.ts                                       |    29.28 |      100 |        0 |    29.28 |... 00,201,202,203 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  manual_task_handler.ts                                          |    28.81 |      100 |        0 |    28.81 |... 15,216,217,218 |
  receive_task_handler.ts                                         |    39.62 |      100 |        0 |    39.62 |... 26,127,128,129 |
  script_task_handler.ts                                          |    31.67 |      100 |        0 |    31.67 |... 89,90,91,92,93 |
  send_task_handler.ts                                            |       40 |      100 |        0 |       40 |... 18,119,120,121 |
  sub_process_handler.ts                                          |    15.57 |      100 |        0 |    15.57 |... 42,343,345,346 |
  user_task_handler.ts                                            |    15.02 |      100 |        0 |    15.02 |... 01,302,303,304 |
 runtime/flow_node_handler/activity_handler/service_task_handlers |    22.53 |      100 |     4.76 |    22.53 |                   |
  external_service_task_handler.ts                                |    15.23 |      100 |        0 |    15.23 |... 29,330,331,332 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  internal_service_task_handler.ts                                |    30.59 |      100 |        0 |    30.59 |... 45,146,147,148 |
  service_task_factory.ts                                         |       60 |      100 |        0 |       60 |... 11,12,13,14,15 |
 runtime/flow_node_handler/boundary_event_handler                 |    44.83 |      100 |     7.41 |    44.83 |                   |
  boundary_event_handler.ts                                       |    57.43 |      100 |        0 |    57.43 |... 63,64,65,66,67 |
  boundary_event_handler_factory.ts                               |    35.62 |      100 |       20 |    35.62 |... 61,62,63,64,65 |
  error_boundary_event_handler.ts                                 |    55.74 |      100 |        0 |    55.74 |... 47,48,49,50,51 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  message_boundary_event_handler.ts                               |    35.09 |      100 |        0 |    35.09 |... 44,45,46,47,48 |
  signal_boundary_event_handler.ts                                |    35.09 |      100 |        0 |    35.09 |... 44,45,46,47,48 |
  timer_boundary_event_handler.ts                                 |    38.75 |      100 |        0 |    38.75 |... 55,57,58,59,60 |
 runtime/flow_node_handler/event_handler                          |    30.16 |      100 |     1.18 |    30.16 |                   |
  end_event_handler.ts                                            |    34.47 |      100 |        0 |    34.47 |... 38,339,340,341 |
  event_handler.ts                                                |    19.41 |      100 |        0 |    19.41 |... 30,331,332,333 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  intermediate_catch_event_factory.ts                             |    44.68 |      100 |        0 |    44.68 |... 26,27,28,29,30 |
  intermediate_empty_event_handler.ts                             |       50 |      100 |        0 |       50 |... 35,36,37,38,39 |
  intermediate_link_catch_event_handler.ts                        |       50 |      100 |        0 |       50 |... 37,38,39,40,41 |
  intermediate_link_throw_event_handler.ts                        |       33 |      100 |        0 |       33 |... 73,74,75,76,77 |
  intermediate_message_catch_event_handler.ts                     |    26.75 |      100 |        0 |    26.75 |... 27,128,129,130 |
  intermediate_message_throw_event_handler.ts                     |    33.77 |      100 |        0 |    33.77 |... 29,130,131,132 |
  intermediate_signal_catch_event_handler.ts                      |    26.75 |      100 |        0 |    26.75 |... 27,128,129,130 |
  intermediate_signal_throw_event_handler.ts                      |    33.77 |      100 |        0 |    33.77 |... 29,130,131,132 |
  intermediate_throw_event_factory.ts                             |    48.65 |      100 |        0 |    48.65 |... 19,20,21,22,23 |
  intermediate_timer_catch_event_handler.ts                       |    24.69 |      100 |        0 |    24.69 |... 31,132,133,134 |
  start_event_handler.ts                                          |    18.91 |      100 |        0 |    18.91 |... 75,176,177,178 |
 runtime/flow_node_handler/gateway_handler                        |    23.09 |      100 |     3.57 |    23.09 |                   |
  exclusive_gateway_handler.ts                                    |    21.36 |      100 |        0 |    21.36 |... 75,176,177,178 |
  gateway_handler.ts                                              |     7.61 |      100 |        0 |     7.61 |... 94,195,196,197 |
  index.ts                                                        |      100 |      100 |      100 |      100 |                   |
  parallel_gateway_factory.ts                                     |    32.69 |      100 |        0 |    32.69 |... 38,39,40,41,42 |
  parallel_join_gateway_handler.ts                                |    25.67 |      100 |        0 |    25.67 |... 51,152,153,155 |
  parallel_split_gateway_handler.ts                               |    57.63 |      100 |        0 |    57.63 |... 30,31,32,33,34 |
------------------------------------------------------------------|----------|----------|----------|----------|-------------------|
