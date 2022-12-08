define([
    'jquery',
    'base/js/utils'
], function ($, utils) {
    function setupDOM() {
        $('#maintoolbar-container').append(
            $('<div>').attr('id', 'jupyter-resource-usage-display')
                .addClass('btn-group')
                .addClass('pull-right')
                .append(
                    $('<strong>').text('Memory: ')
                ).append(
                $('<span>').attr('id', 'jupyter-resource-usage-mem')
                    .attr('title', 'Actively used Memory (updates every 5s)')
            )
        );
        $('#maintoolbar-container').append(
            $('<div>').attr('id', 'jupyter-resource-usage-display-cpu')
                .addClass('btn-group')
                .addClass('jupyter-resource-usage-hide')
                .addClass('pull-right').append(
                    $('<strong>').text(' CPU: ')
                ).append(
                    $('<span>').attr('id', 'jupyter-resource-usage-cpu')
                        .attr('title', 'Actively used CPU (updates every 5s)')
            )
        );
        // FIXME: Do something cleaner to get styles in here?
        $('head').append(
            $('<style>').html('.jupyter-resource-usage-warn { background-color: #FFD2D2; color: #D8000C; }')
        );
        $('head').append(
            $('<style>').html('.jupyter-resource-usage-hide { display: none; }')
        );
        $('head').append(
            $('<style>').html('#jupyter-resource-usage-display { padding: 2px 8px; }')
        );
        $('head').append(
            $('<style>').html('#jupyter-resource-usage-display-cpu { padding: 2px 8px; }')
        );
        $('head').append(
            $('<style type="text/css">').html('.content { position: absolute; top:50%; left:50%; width: 500px; height:200px; text-align: center; background-color: #e8eae6; box-sizing: border-box; padding: 10px; z-index: 100; display: none;}')
        );
        $('head').append(
            $('<style type="text/css">').html('.mem-overlay { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center; z-index: 9999; align-items: center; pointer-events: none; opacity: 0; transition: all 0.5s cubic-bezier(0.59, -0.17, 0.3, 1.67);}')
        );
        $('head').append(
            $('<style type="text/css">').html('.mo-visible {opacity: 1; pointer-events: auto;}')
        );
        $('head').append(
            $('<style type="text/css">').html('.mem-modal { transform: translate(0px, -50px); transition: all 0.7s cubic-bezier(0.59, -0.17, 0.3, 1.67); position: relative; padding: 30px; border-radius: 10px; width: 400px; background-color: #fff; color: #231D23; text-align: center; overflow: hidden; box-shadow: 0px 4px 20px 0px rgba(0, 0, 0, 0.4); .lead { font-size: 24px; margin-top: 10px; text-transform: Uppercase; } .text { margin-bottom: 40px; color: black; font-size: 18px; }')
        );
        $('head').append(
            $('<style type="text/css">').html( '.close-button { background-color: #795fcb; color:white; border:0; border-radius: 5px; padding: 5px 10px; margin-top: 2rem;}')
        );
        $('body').append( $('<div class="mem-overlay"> <div class="mem-modal"> <div class="text-box"> <p class="lead">Memory Usage Exceeding</p> <p class="text"> You have used 70% of the allocated memory. Please take corrective measures to prevent kernel from restarting</p></div><button class="close-button">Close</button></div></div>'));
    }

    function humanFileSize(size) {
        var i = Math.floor(Math.log(size) / Math.log(1024));
        return (size / Math.pow(1024, i)).toFixed(1) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
    }

    var displayMetrics = function () {
        if (document.hidden) {
            // Don't poll when nobody is looking
            return;
        }
        $.getJSON({
            url: utils.get_body_data('baseUrl') + 'api/metrics/v1',
            success: function (data) {
                $('.close-button').click(function () {
                    console.log('closing the pop up')
                    $('.mem-overlay').removeClass('mo-visible');
                });

                totalMemoryUsage = humanFileSize(data['rss']);

                var limits = data['limits'];
                var display = totalMemoryUsage;

                if (limits['memory']) {
                    if (limits['memory']['rss']) {
                        maxMemoryUsage = humanFileSize(limits['memory']['rss']);
                        display += " / " + maxMemoryUsage
                    }
                    if (limits['memory']['warn']) {
                        $('#jupyter-resource-usage-display').addClass('jupyter-resource-usage-warn');
                        // Disable the pop up after showing it once
                        if (window.showMemWarning) {
                            $('.mem-overlay').addClass('mo-visible');
                            window.showMemWarning = false
                        }
                    } else {
                        $('#jupyter-resource-usage-display').removeClass('jupyter-resource-usage-warn');
                        // Memory usage went down. Enable 'showMemWarning' again so that pop up can be shown
                        // if the usage crosses the limit
                        window.showMemWarning = true
                    }
                }

                $('#jupyter-resource-usage-mem').text(display);
                // Handle CPU display
                var cpuPercent = data['cpu_percent'];
                if (cpuPercent !== undefined) {
                    // Remove hide CSS class if the metrics API gives us a CPU percent to display
                    $('#jupyter-resource-usage-display-cpu').removeClass('jupyter-resource-usage-hide');
                    var maxCpu = data['cpu_count'];
                    var limits = data['limits'];
                    // Display CPU usage as "{percent}% ({usedCpu} / {maxCPU})" e.g. "123% (1 / 8)"
                    var percentString = parseFloat(cpuPercent).toFixed(0);
                    var usedCpu = Math.round(parseFloat(cpuPercent) / 100).toString();
                    var display = `${percentString}% (${usedCpu} / ${maxCpu})`;
                    // Handle limit warning
                    if (limits['cpu']) {
                        if (limits['cpu']['warn']) {
                            $('#jupyter-resource-usage-display-cpu').addClass('jupyter-resource-usage-warn');
                        } else {
                            $('#jupyter-resource-usage-display-cpu').removeClass('jupyter-resource-usage-warn');
                        }
                    }
    
                    $('#jupyter-resource-usage-cpu').text(display);    
                }
            }
        });
    };

    var load_ipython_extension = function () {
        window.showMemWarning = true;
        setupDOM();
        displayMetrics();
        // Update every five seconds, eh?
        setInterval(displayMetrics, 1000 * 5);

        document.addEventListener("visibilitychange", function () {
            // Update instantly when user activates notebook tab
            // FIXME: Turn off update timer completely when tab not in focus
            if (!document.hidden) {
                displayMetrics();
            }
        }, false);
    };

    return {
        load_ipython_extension: load_ipython_extension,
    };
});
