cmake_minimum_required(VERSION 2.8)

project(geojs NONE)

include(CTest)
enable_testing()

set(BUILD_TESTING ON CACHE BOOL "Enable geojs testing")
set(PHANTOMJS_TESTS ON CACHE BOOL "Generate phantomjs unit tests.")
set(FFHEADLESS_TESTS ON CACHE BOOL "Generate headless Firefox unit tests (requires xvfb to be running).")
set(TEST_SAVE_IMAGE "none" CACHE STRING "Save headless test images even if there aren't errors.  Valid options are none, all, or the a comma-separated list of test names.")
set(ESLINT_TESTS ON CACHE BOOL "Generate eslint style tests for JS source files.")
set(SELENIUM_TESTS ON CACHE BOOL "Generate selenium unit tests.")

site_name(HOSTNAME)

set(TESTING_HOST "${HOSTNAME}" CACHE STRING "The host to connect to for unit tests")
set(TESTING_PORT 30100 CACHE STRING "The port number to use for the testing web server")
mark_as_advanced(TESTING_PORT)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")

set(NOTES_PATH "${CMAKE_CURRENT_BINARY_DIR}/build_notes.json")

# set the path where webpack builds the sources
set(GEOJS_DEPLOY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/dist")

function(add_geojs_test test_name)
  add_test(
    NAME "${test_name}"
    WORKING_DIRECTORY "${GEOJS_DEPLOY_DIR}"
    COMMAND ${PYTHON_EXECUTABLE}
            ${CMAKE_CURRENT_BINARY_DIR}/test/geojs_test_runner.py
            ${ARGN}
  )
  set_property(TEST "${test_name}" APPEND PROPERTY DEPENDS "notes-reset")
  set_property(TEST "notes-report" APPEND PROPERTY DEPENDS "${test_name}")
endfunction()

set(MIDAS_BASE_URL "https://midas3.kitware.com/midas" CACHE STRING "MIDAS data store URL.")
mark_as_advanced(MIDAS_BASE_URL)
set(MIDAS_COMMUNITY "GeoJS" CACHE STRING "MIDAS community hosting test images.")
mark_as_advanced(MIDAS_COMMUNITY)

# set variables for girder.cmake
set(Girder_KEY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-data")
set(Girder_DATA_DIR "${GEOJS_DEPLOY_DIR}/data")
include(${CMAKE_CURRENT_SOURCE_DIR}/cmake/girder.cmake)

add_download_target()

configure_file(${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/geojs_test_runner.py.in
               ${CMAKE_CURRENT_BINARY_DIR}/test/geojs_test_runner.py
)

configure_file(${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/selenium-test-utils.js
               ${GEOJS_DEPLOY_DIR}/test/lib/selenium-test-utils.js
               COPYONLY
)

# Generate notes to send along with the test reports
add_test(
  NAME "notes-reset"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMAND "./tests/notes.js" "reset" "${CMAKE_CURRENT_BINARY_DIR}/notes" "${NOTES_PATH}"
)

add_test(
  NAME "notes-report"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMAND "./tests/notes.js" "combine" "${CMAKE_CURRENT_BINARY_DIR}/notes" "${NOTES_PATH}"
)
set_property(TEST "notes-report" APPEND PROPERTY DEPENDS "notes-reset")

add_test(
  NAME "total-coverage"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  COMMAND npm run combine-coverage
)
set_property(TEST "notes-report" APPEND PROPERTY DEPENDS "notes-reset")

if(PHANTOMJS_TESTS)
  find_program(NPM_EXECUTABLE npm)
  add_test(
    NAME "phantomjs"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    COMMAND npm run ci
  )
  set_property(TEST "phantomjs" APPEND PROPERTY ENVIRONMENT "CTEST_NOTES_PATH=${CMAKE_CURRENT_BINARY_DIR}/notes")
  set_property(TEST "phantomjs" APPEND PROPERTY DEPENDS "notes-reset")
  set_property(TEST "notes-report" APPEND PROPERTY DEPENDS "phantomjs")
  set_property(TEST "total-coverage" APPEND PROPERTY DEPENDS "phantomjs")
endif()

add_custom_target(
  data_files
  ALL
  DEPENDS ${Girder_DOWNLOAD_FILES}
)
add_test(NAME get_data_files COMMAND "${CMAKE_COMMAND}" --build ${CMAKE_BINARY_DIR} --target data_files)

if(FFHEADLESS_TESTS)
  find_program(NPM_EXECUTABLE npm)
  add_test(
    NAME "ffheadless"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    COMMAND npm run ffci
  )
  set_property(TEST "ffheadless" APPEND PROPERTY ENVIRONMENT "CTEST_IMAGE_PATH=${CMAKE_CURRENT_BINARY_DIR}/images")
  set_property(TEST "ffheadless" APPEND PROPERTY ENVIRONMENT "TEST_SAVE_IMAGE=${TEST_SAVE_IMAGE}")
  set_property(TEST "total-coverage" APPEND PROPERTY DEPENDS "ffheadless")
  set_property(TEST "ffheadless" APPEND PROPERTY DEPENDS "get_data_files")

  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/baseline_images.py"
    "${CMAKE_CURRENT_BINARY_DIR}/test/baseline_images.py"
    COPYONLY
  )
endif()

add_custom_command(OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/base-images.tgz"
  WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
  # Make sure we have the data files.
  COMMAND "${CMAKE_COMMAND}" --build ${CMAKE_BINARY_DIR} --target data_files
  # Run the ffheadless test, asking to save all images
  COMMAND TEST_SAVE_IMAGE=all npm run ffci
  # Make a tarball of all of the images
  COMMAND tar -zcvf "${CMAKE_CURRENT_BINARY_DIR}/base-images.tgz" --exclude=*-test.png --exclude=*-diff.png --exclude=*-base.png -C "${CMAKE_CURRENT_BINARY_DIR}/images" .
  COMMENT "Create baseline images, then tar them into a single file"
  VERBATIM
)

add_custom_target(baseline_images DEPENDS "${CMAKE_CURRENT_BINARY_DIR}/base-images.tgz")

add_test(NAME baseline_images CONFIGURATIONS "baseline_images" COMMAND "${CMAKE_COMMAND}" --build ${CMAKE_BINARY_DIR} --target baseline_images)
set_property(TEST "baseline_images" APPEND PROPERTY ENVIRONMENT "CTEST_IMAGE_PATH=${CMAKE_CURRENT_BINARY_DIR}/images")

if(SELENIUM_TESTS)

  find_package(PythonInterp REQUIRED)
  set(FIREFOX_TESTS ON CACHE BOOL "Turn on Firefox selenium tests.")
  set(CHROME_TESTS OFF CACHE BOOL "Turn on Chrome selenium tests.")
  set(DATA_REPO_PATH "" CACHE PATH "Local path to the geojs data repository (optional).")
  set(SELENIUM_TEST_DIR "${GEOJS_DEPLOY_DIR}/test/selenium")
  set(SELENIUM_HOST localhost CACHE STRING "The selenium test server host.")
  mark_as_advanced(SELENIUM_HOST)
  set(SELENIUM_PORT 4444 CACHE STRING "The selenium test server port.")
  mark_as_advanced(SELENIUM_PORT)

  configure_file(
    ${CMAKE_CURRENT_SOURCE_DIR}/testing/js/selenium-blanket.js
    ${GEOJS_DEPLOY_DIR}/test/lib/selenium-blanket.js
    COPYONLY
  )
  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/selenium_test.py.in"
    "${CMAKE_CURRENT_BINARY_DIR}/test/selenium_test.py"
  )
  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/midas_handler.py"
    "${CMAKE_CURRENT_BINARY_DIR}/test/midas_handler.py"
    COPYONLY
  )
  configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/upload_test_cases.py"
    "${CMAKE_CURRENT_BINARY_DIR}/test/upload_test_cases.py"
    COPYONLY
  )
  file(GLOB SELENIUM_TEST_DIRS
    ${CMAKE_CURRENT_SOURCE_DIR}/testing/test-cases/selenium-tests/*
  )
  foreach(dir ${SELENIUM_TEST_DIRS})
    if(IS_DIRECTORY "${dir}" AND EXISTS "${dir}/include.js")
      set(html "${dir}/include.html")
      set(js "${dir}/include.js")
      set(css "${dir}/include.css")
      get_filename_component(f "${dir}" NAME_WE)
      set(test_dir "${SELENIUM_TEST_DIR}/${f}")
      set(output_html "${test_dir}/index.html")

      add_custom_command(OUTPUT "${output_html}"
        COMMAND ${CMAKE_COMMAND} -DHTML_INCLUDE="${html}"
                                 -DJS_INCLUDE="${js}"
                                 -DCSS_INCLUDE="${css}"
                                 -DOUTPUT_HTML="${output_html}"
                                 -DTEMPLATE_HTML="${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/selenium-template.html.in"
                                 -P ${CMAKE_SOURCE_DIR}/cmake/configure-js-selenium-test.cmake
        COMMAND ${CMAKE_COMMAND} -E touch "${output_html}"
        DEPENDS "${html}" "${js}" "${css}" "${CMAKE_CURRENT_SOURCE_DIR}/testing/test-runners/selenium-template.html.in"
        COMMENT "Generating selenium test ${f}"
      )
      list(APPEND SELENIUM_TEST_FILES "${output_html}")

      add_test(
        NAME "selenium:${f}"
        WORKING_DIRECTORY "${GEOJS_DEPLOY_DIR}"
        COMMAND ${PYTHON_EXECUTABLE} -m unittest discover -v -s "${dir}"
      )

      set_property(TEST "selenium:${f}" APPEND PROPERTY DEPENDS "notes-reset")
      set_property(TEST "notes-report" APPEND PROPERTY DEPENDS "selenium:${f}")
      set_property(TEST "selenium:${f}" APPEND PROPERTY ENVIRONMENT "PYTHONPATH=${CMAKE_CURRENT_BINARY_DIR}/test")
      set_property(TEST "selenium:${f}" APPEND PROPERTY ENVIRONMENT "FIREFOX_TESTS=${FIREFOX_TESTS}")
      set_property(TEST "selenium:${f}" APPEND PROPERTY ENVIRONMENT "CHROME_TESTS=${CHROME_TESTS}")
    endif()
  endforeach()

  set_property(TEST "selenium:glPointsSpeed" APPEND PROPERTY ENVIRONMENT "LOAD_SPEED_THRESHOLD=1000")
  set_property(TEST "selenium:glPointsSpeed" APPEND PROPERTY ENVIRONMENT "FRAMERATE_THRESHOLD=5")

  set_property(TEST "selenium:glLinesSpeed" APPEND PROPERTY ENVIRONMENT "LOAD_SPEED_THRESHOLD=1000")
  set_property(TEST "selenium:glLinesSpeed" APPEND PROPERTY ENVIRONMENT "FRAMERATE_THRESHOLD=2")

  add_custom_target(
    selenium_tests
    ALL
    DEPENDS ${SELENIUM_TEST_FILES} ${Girder_DOWNLOAD_FILES}
  )

endif()

if(${ESLINT_TESTS})

  find_program(NPM_EXECUTABLE npm)
  if(NOT NPM_EXECUTABLE)
    message(FATAL_ERROR "npm is required for style checks")
  endif()
  add_test(
    NAME "eslint"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}"
    COMMAND "${NPM_EXECUTABLE}" "run" "lint"
  )

endif() # ESLINT_TESTS
